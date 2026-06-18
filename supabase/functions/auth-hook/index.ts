/**
 * Auth hook — called by Supabase Auth's `send_email` hook.
 *
 * Production config.toml:
 *   [auth.hook.send_email]
 *   enabled = true
 *   uri     = "https://<project>.supabase.co/functions/v1/auth-hook"
 *   secrets = ["HOOK_SECRET"]
 *
 * The hook receives a signed payload and forwards it to Trigger.dev,
 * which handles the actual email delivery via Resend.
 *
 * In local dev this function is NOT wired to the auth hook — emails go
 * straight to Mailpit so no Trigger.dev or Resend credentials are needed.
 */

import { handleCors, corsHeaders } from "../_shared/cors.ts"

interface HookUser {
  id: string
  email: string
  raw_user_meta_data?: {
    full_name?: string
    display_name?: string
    name?: string
  }
}

interface HookEmailData {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: "signup" | "recovery" | "invite" | "magic_link" | "email_change"
  site_url: string
}

interface HookPayload {
  user: HookUser
  email_data: HookEmailData
}

const TASK_IDS: Record<HookEmailData["email_action_type"], string | null> = {
  signup:       "auth.send-verification",
  recovery:     "auth.send-password-reset",
  invite:       "auth.send-verification",
  magic_link:   null, // not used — Supabase handles magic links natively
  email_change: null, // not used — let Supabase handle email change
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Verify the shared secret Supabase sends in the Authorization header.
  const hookSecret = Deno.env.get("HOOK_SECRET")
  if (hookSecret) {
    const auth = req.headers.get("authorization") ?? ""
    if (auth !== `Bearer ${hookSecret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      })
    }
  }

  let payload: HookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const { user, email_data } = payload
  const taskId = TASK_IDS[email_data.email_action_type]

  if (!taskId) {
    // Let Supabase handle this email type natively.
    return new Response(JSON.stringify({ message: "skipped" }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const displayName =
    user.raw_user_meta_data?.full_name ??
    user.raw_user_meta_data?.display_name ??
    user.raw_user_meta_data?.name ??
    user.email.split("@")[0]

  // The confirmation URL ready for the recipient to click.
  const actionUrl = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`

  const triggerSecretKey = Deno.env.get("TRIGGER_SECRET_KEY")
  if (!triggerSecretKey) {
    console.error("TRIGGER_SECRET_KEY not set — cannot trigger email job")
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Configurable so a self-hosted Trigger.dev instance can be used instead of
  // the cloud API. Defaults to the cloud endpoint.
  const triggerApiUrl = (Deno.env.get("TRIGGER_API_URL") ?? "https://api.trigger.dev").replace(/\/$/, "")

  const triggerRes = await fetch(
    `${triggerApiUrl}/api/v1/tasks/${taskId}/trigger`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${triggerSecretKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        payload: {
          email:           user.email,
          displayName,
          actionUrl,
          emailActionType: email_data.email_action_type,
        },
      }),
    },
  )

  if (!triggerRes.ok) {
    const body = await triggerRes.text()
    console.error("Trigger.dev error:", triggerRes.status, body)
    // Return 500 — Supabase will fall back to its built-in sender.
    return new Response(JSON.stringify({ error: "job trigger failed" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ message: "email job triggered" }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
})
