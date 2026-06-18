/**
 * digest.daily — Trigger.dev v3 scheduled task
 *
 * Runs at 08:00 UTC every day. Sends a digest email to all users who have
 * opted in via profiles.settings.digest_enabled = true.
 *
 * Digest contents:
 *   - Tasks due today (is_completed = false, due_date = today)
 *   - Overdue tasks (is_completed = false, due_date < today)
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL, APP_URL
 */

import { schedules } from "@trigger.dev/sdk/v3"
import { createClient } from "@supabase/supabase-js"
import { sendEmail, emailConfigured } from "../lib/email.js"
import { digestEmail } from "../lib/email-templates.js"

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0]
}

export const dailyDigest = schedules.task({
  id: "digest.daily",
  cron: "0 8 * * *",  // 08:00 UTC daily

  run: async () => {
    const url = process.env["SUPABASE_URL"]
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    if (!emailConfigured()) throw new Error("No email transport configured (SMTP_HOST or RESEND_API_KEY)")

    const db     = createClient(url, key, { auth: { persistSession: false } })
    const from   = process.env["FROM_EMAIL"]  ?? "noreply@justdoit.app"
    const appUrl = process.env["APP_URL"]     ?? "https://justdoit.app"
    const today  = toDateString(new Date())

    // Fetch profiles with digest opted in
    const { data: profiles } = await db
      .from("profiles")
      .select("id, display_name, settings")
      .filter("settings->digest_enabled", "eq", "true")

    if (!profiles?.length) return { sent: 0 }

    let sent = 0

    for (const profile of profiles) {
      // Resolve user email
      const { data: { user } } = await db.auth.admin.getUserById(profile.id)
      if (!user?.email) continue

      // Due today
      const { data: dueToday } = await db
        .from("tasks")
        .select("title, todo_lists!list_id(title)")
        .eq("due_date", today)
        .eq("is_completed", false)
        // RLS doesn't apply with service role; filter by user via list ownership
        .in("list_id", (
          await db.from("todo_lists").select("id").eq("user_id", profile.id)
        ).data?.map(l => l.id) ?? [])

      // Overdue
      const { data: overdue } = await db
        .from("tasks")
        .select("title, due_date, todo_lists!list_id(title)")
        .lt("due_date", today)
        .eq("is_completed", false)
        .in("list_id", (
          await db.from("todo_lists").select("id").eq("user_id", profile.id)
        ).data?.map(l => l.id) ?? [])

      const dueTodayTasks = (dueToday ?? []).map(t => ({
        title:      t.title,
        list_title: (t.todo_lists as { title: string } | null)?.title ?? "",
      }))

      const overdueTasks = (overdue ?? []).map(t => ({
        title:      t.title,
        list_title: (t.todo_lists as { title: string } | null)?.title ?? "",
        due_date:   t.due_date ?? "",
      }))

      // Skip digest if nothing to show
      if (!dueTodayTasks.length && !overdueTasks.length) continue

      const { subject, html } = digestEmail({
        displayName: profile.display_name,
        dueTodayTasks,
        overdueTasks,
        appUrl,
      })

      await sendEmail({ from, to: user.email, subject, html })
      sent++
    }

    return { sent, total: profiles.length }
  },
})
