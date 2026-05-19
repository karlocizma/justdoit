/**
 * POST /functions/v1/workspace-invite
 *
 * Invites a registered user (by email) to a workspace.
 * Caller must be an owner or admin of the workspace.
 *
 * Request body: { workspace_id: string, email: string }
 *
 * Responses:
 *   201  { invited: true, user_id: string }                   — pending invite created
 *   200  { already_member: true }                             — already invited or accepted
 *   400  { error: "workspace_id and email are required" }
 *   401  { error: "missing authorization header" | "invalid session" }
 *   403  { error: "only workspace owners and admins can invite" }
 *   404  { error: "no user found with that email" }
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

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // User-scoped client for resolving the caller's identity
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Parse body
  const body = await req.json().catch(() => null)
  const workspace_id: string | undefined = body?.workspace_id
  const email: string | undefined = body?.email
  if (!workspace_id || !email) {
    return new Response(JSON.stringify({ error: "workspace_id and email are required" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  // Service-role client for admin operations (user lookup, membership insert)
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Verify the caller is an accepted owner or admin of the workspace
  const { data: membership } = await adminClient
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return new Response(
      JSON.stringify({ error: "only workspace owners and admins can invite" }),
      { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Resolve invited user's ID via SECURITY DEFINER helper (avoids exposing auth.users)
  const { data: invitedUserId } = await adminClient.rpc("get_user_id_by_email", {
    p_email: email.toLowerCase(),
  })

  if (!invitedUserId) {
    return new Response(
      JSON.stringify({ error: "no user found with that email" }),
      { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Check if already a member (pending or accepted)
  const { data: existing } = await adminClient
    .from("workspace_members")
    .select("accepted_at")
    .eq("workspace_id", workspace_id)
    .eq("user_id", invitedUserId)
    .single()

  if (existing) {
    return new Response(
      JSON.stringify({ already_member: true }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Create pending invite (service role bypasses INSERT policy — auth check already done above)
  const { error: insertErr } = await adminClient
    .from("workspace_members")
    .insert({
      workspace_id,
      user_id:     invitedUserId,
      role:        "member",
      invited_by:  user.id,
      accepted_at: null,
    })

  if (insertErr) {
    console.error("Failed to create invite:", insertErr.message)
    return new Response(
      JSON.stringify({ error: "failed to create invite" }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    )
  }

  // Optional: send invite email if RESEND_API_KEY is configured
  const resendKey = Deno.env.get("RESEND_API_KEY")
  if (resendKey) {
    const from    = Deno.env.get("FROM_EMAIL") ?? "noreply@justdoit.app"
    const appUrl  = Deno.env.get("APP_URL")    ?? "https://justdoit.app"

    const { data: ws } = await adminClient
      .from("workspaces")
      .select("name")
      .eq("id", workspace_id)
      .single()

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: `You've been invited to "${ws?.name ?? "a workspace"}" on JustDoIt`,
        html: `<p>You've been invited to collaborate. <a href="${appUrl}">Open JustDoIt</a> to accept.</p>`,
      }),
    }).catch(e => console.warn("Email send failed:", e))
  }

  return new Response(
    JSON.stringify({ invited: true, user_id: invitedUserId }),
    { status: 201, headers: { ...corsHeaders, "content-type": "application/json" } },
  )
})
