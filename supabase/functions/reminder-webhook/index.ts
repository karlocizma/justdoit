/**
 * POST /functions/v1/reminder-webhook
 *
 * Called by the `on_reminder_insert` database trigger via pg_net whenever a
 * row is inserted into public.reminders.
 *
 * Responsibilities:
 *   1. Verify the x-webhook-secret header (if WEBHOOK_SECRET env var is set)
 *   2. Trigger the reminder.send Trigger.dev job with wait.until(remind_at)
 *   3. Write the returned run ID back to reminders.trigger_job_id
 *
 * When TRIGGER_SECRET_KEY is not set (local dev without Trigger.dev) the
 * function returns 200 with { scheduled: false } so the pg_net call succeeds.
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

interface ReminderRecord {
  id:             string
  user_id:        string
  task_id:        string | null
  note_id:        string | null
  remind_at:      string
  channel:        string
  is_sent:        boolean
  trigger_job_id: string | null
  created_at:     string
}

interface WebhookPayload {
  type:       "INSERT" | "UPDATE" | "DELETE"
  table:      string
  schema:     string
  record:     ReminderRecord
  old_record: null
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Optional webhook secret — skip check in local dev when not configured
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")
  if (webhookSecret) {
    if (req.headers.get("x-webhook-secret") !== webhookSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      })
    }
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Only act on INSERT; ignore UPDATE/DELETE from any future webhook expansion
  if (payload.type !== "INSERT") {
    return new Response(JSON.stringify({ message: "ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const reminder = payload.record

  const triggerKey = Deno.env.get("TRIGGER_SECRET_KEY")
  if (!triggerKey) {
    console.warn("TRIGGER_SECRET_KEY not configured — reminder scheduling skipped")
    return new Response(
      JSON.stringify({ scheduled: false, reason: "TRIGGER_SECRET_KEY not configured" }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Trigger the reminder.send job — it will wait.until(remind_at) then fire
  const triggerRes = await fetch(
    "https://api.trigger.dev/api/v1/tasks/reminder.send/trigger",
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${triggerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          reminder_id: reminder.id,
          user_id:     reminder.user_id,
          remind_at:   reminder.remind_at,
          channel:     reminder.channel,
          task_id:     reminder.task_id,
          note_id:     reminder.note_id,
        },
      }),
    },
  )

  if (!triggerRes.ok) {
    console.error("Trigger.dev error:", triggerRes.status, await triggerRes.text())
    return new Response(JSON.stringify({ error: "failed to schedule job" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const { id: runId } = await triggerRes.json()

  // Store the run ID so it can be used later to cancel the job
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { error: updateErr } = await supabase
    .from("reminders")
    .update({ trigger_job_id: runId })
    .eq("id", reminder.id)

  if (updateErr) {
    console.error("Failed to store trigger_job_id:", updateErr.message)
  }

  return new Response(JSON.stringify({ scheduled: true, run_id: runId }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
})
