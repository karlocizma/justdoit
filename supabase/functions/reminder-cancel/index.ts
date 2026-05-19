/**
 * POST /functions/v1/reminder-cancel
 * Body: { "reminder_id": "<uuid>" }
 *
 * Cancels a pending reminder:
 *   1. Verifies the caller owns the reminder (via JWT + RLS)
 *   2. Cancels the Trigger.dev run (if trigger_job_id is stored)
 *   3. Deletes the reminder row
 *
 * Returns 409 if the reminder has already been sent.
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  let body: { reminder_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  if (!body.reminder_id) {
    return new Response(JSON.stringify({ error: "'reminder_id' is required" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Use the user's JWT so RLS prevents access to other users' reminders
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: reminder, error: fetchErr } = await userClient
    .from("reminders")
    .select("id, trigger_job_id, is_sent")
    .eq("id", body.reminder_id)
    .single()

  if (fetchErr || !reminder) {
    return new Response(JSON.stringify({ error: "reminder not found" }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  if (reminder.is_sent) {
    return new Response(JSON.stringify({ error: "reminder already sent — cannot cancel" }), {
      status: 409,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Attempt to cancel the Trigger.dev run (best-effort — delete proceeds regardless)
  let jobCancelled = false
  if (reminder.trigger_job_id) {
    const triggerKey = Deno.env.get("TRIGGER_SECRET_KEY")
    if (triggerKey) {
      const res = await fetch(
        `https://api.trigger.dev/api/v3/runs/${reminder.trigger_job_id}/cancel`,
        {
          method:  "PUT",
          headers: {
            Authorization:  `Bearer ${triggerKey}`,
            "Content-Type": "application/json",
          },
        },
      )
      jobCancelled = res.ok
      if (!res.ok) {
        console.warn("Trigger.dev cancel failed:", res.status, await res.text())
      }
    }
  }

  // Delete the reminder — user client enforces ownership via RLS
  const { error: delErr } = await userClient
    .from("reminders")
    .delete()
    .eq("id", body.reminder_id)

  if (delErr) {
    return new Response(JSON.stringify({ error: "failed to delete reminder" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({ deleted: true, job_cancelled: jobCancelled }),
    { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
  )
})
