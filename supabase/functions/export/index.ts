/**
 * POST /functions/v1/export
 *
 * Kicks off the export.generate Trigger.dev job for the authenticated user.
 * Returns immediately with the Trigger.dev run ID for polling.
 *
 * Response:
 *   { scheduled: true, run_id: string }         — job queued
 *   { scheduled: false, reason: string }         — TRIGGER_SECRET_KEY not set
 *
 * The job builds a ZIP, uploads it to Storage, and emails the download link.
 * There is nothing else the client needs to do — no polling endpoint is needed
 * because the email is the delivery mechanism.
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

  // Resolve caller's user ID
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const triggerKey = Deno.env.get("TRIGGER_SECRET_KEY")
  if (!triggerKey) {
    console.warn("TRIGGER_SECRET_KEY not configured — export scheduling skipped")
    return new Response(
      JSON.stringify({ scheduled: false, reason: "TRIGGER_SECRET_KEY not configured" }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Trigger the export.generate job
  const triggerRes = await fetch(
    "https://api.trigger.dev/api/v1/tasks/export.generate/trigger",
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${triggerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: { user_id: user.id, run_id: crypto.randomUUID() },
      }),
    },
  )

  if (!triggerRes.ok) {
    const body = await triggerRes.text()
    console.error("Trigger.dev error:", triggerRes.status, body)
    return new Response(JSON.stringify({ error: "failed to start export job" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const { id: runId } = await triggerRes.json()

  return new Response(JSON.stringify({ scheduled: true, run_id: runId }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
})
