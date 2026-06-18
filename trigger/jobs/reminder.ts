/**
 * reminder.send — Trigger.dev v3 task
 *
 * Scheduled by the reminder-webhook Edge Function when a reminder row is
 * inserted. Flow:
 *   1. wait.until(remind_at)     — suspend until the scheduled moment
 *   2. Re-fetch the reminder     — skip if already sent or deleted
 *   3. Send notification         — email via Resend (channel = "email")
 *                                  in_app: mark sent only (notifications table: Milestone 7)
 *   4. Mark reminder as is_sent = true
 *
 * Env vars required (set in Trigger.dev project secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY, FROM_EMAIL
 *   APP_URL
 */

import { task, wait } from "@trigger.dev/sdk/v3"
import { createClient } from "@supabase/supabase-js"
import { sendEmail, emailConfigured } from "../lib/email.js"
import { reminderEmail } from "../lib/email-templates.js"

interface ReminderPayload {
  reminder_id: string
  user_id:     string
  remind_at:   string
  channel:     "in_app" | "email" | "push"
  task_id:     string | null
  note_id:     string | null
}

function supabaseAdmin() {
  const url = process.env["SUPABASE_URL"]
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  return createClient(url, key, { auth: { persistSession: false } })
}

export const sendReminder = task({
  id: "reminder.send",
  retry: {
    maxAttempts:      3,
    minTimeoutInMs:   5_000,
    maxTimeoutInMs:   60_000,
    factor:           2,
  },

  run: async (payload: ReminderPayload) => {
    // Suspend until the scheduled moment (Trigger.dev checkpoints the run)
    await wait.until({ date: new Date(payload.remind_at) })

    const db = supabaseAdmin()

    // Re-check in case the reminder was cancelled or already sent while waiting
    const { data: reminder } = await db
      .from("reminders")
      .select("id, is_sent, channel")
      .eq("id", payload.reminder_id)
      .single()

    if (!reminder) {
      return { skipped: true, reason: "reminder deleted" }
    }
    if (reminder.is_sent) {
      return { skipped: true, reason: "already sent" }
    }

    // Fetch user profile + linked item title in parallel
    const [profileRes, itemRes] = await Promise.all([
      db.from("profiles").select("display_name").eq("id", payload.user_id).single(),
      payload.note_id
        ? db.from("notes").select("title").eq("id", payload.note_id).single()
        : db.from("tasks").select("title").eq("id", payload.task_id!).single(),
    ])

    const displayName  = profileRes.data?.display_name ?? "there"
    const contextTitle = itemRes.data?.title ?? "untitled"
    const contextKind  = payload.note_id ? "note" as const : "task" as const

    if (reminder.channel === "email") {
      // Resolve user email via admin API (bypasses RLS)
      const { data: { user } } = await db.auth.admin.getUserById(payload.user_id)
      if (!user?.email) throw new Error(`no email for user ${payload.user_id}`)

      if (!emailConfigured()) throw new Error("No email transport configured (SMTP_HOST or RESEND_API_KEY)")

      const { subject, html } = reminderEmail({
        displayName,
        contextKind,
        contextTitle,
        appUrl: process.env["APP_URL"] ?? "https://justdoit.app",
      })

      await sendEmail({
        from:    process.env["FROM_EMAIL"] ?? "noreply@justdoit.app",
        to:      user.email,
        subject,
        html,
      })
    }
    // push channel: handled by a future mobile push job (Milestone 7)
    // in_app:      mark sent — the client polls / uses Realtime for in-app display

    // Mark as sent
    await db
      .from("reminders")
      .update({ is_sent: true })
      .eq("id", payload.reminder_id)

    return { sent: true, channel: reminder.channel, contextKind, contextTitle }
  },
})
