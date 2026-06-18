/**
 * GET /functions/v1/admin-stats
 *
 * App-operator dashboard data: aggregate metrics across ALL users. Gated on the
 * global `profiles.is_admin` flag (distinct from workspace roles).
 *
 * The caller's JWT identifies them; their admin status is checked with the
 * service-role key, and the aggregate queries then run with the service-role key
 * (bypassing RLS) so counts span every user. The service-role key never leaves
 * the server.
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "missing authorization header" }, 401)

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // Identify the caller from their JWT.
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: "invalid token" }, 401)

  // Verify admin with the service role (bypasses RLS).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).single()
  if (!me?.is_admin) return json({ error: "forbidden" }, 403)

  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    users, newUsers, recentUsers,
    notesActive, notesTrash,
    tasksTotal, tasksDone,
    workspaces, members,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("profiles").select("id, display_name, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("notes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("notes").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    admin.from("tasks").select("id", { count: "exact", head: true }),
    admin.from("tasks").select("id", { count: "exact", head: true }).eq("is_completed", true),
    admin.from("workspaces").select("id", { count: "exact", head: true }),
    admin.from("workspace_members").select("workspace_id").not("accepted_at", "is", null),
  ])

  const firstError = [
    users.error, newUsers.error, recentUsers.error, notesActive.error,
    notesTrash.error, tasksTotal.error, tasksDone.error, workspaces.error, members.error,
  ].find(Boolean)
  if (firstError) return json({ error: firstError.message }, 400)

  // Active workspaces = distinct workspaces with at least one accepted member.
  const activeWorkspaces = new Set((members.data ?? []).map(m => m.workspace_id)).size

  return json({
    generated_at: new Date().toISOString(),
    users: {
      total:        users.count ?? 0,
      new_last_7d:  newUsers.count ?? 0,
    },
    notes: {
      total:    notesActive.count ?? 0,
      in_trash: notesTrash.count ?? 0,
    },
    tasks: {
      total:     tasksTotal.count ?? 0,
      completed: tasksDone.count ?? 0,
    },
    workspaces: {
      total:  workspaces.count ?? 0,
      active: activeWorkspaces,
    },
    recent_signups: (recentUsers.data ?? []).map(u => ({
      id:           u.id,
      display_name: u.display_name,
      created_at:   u.created_at,
    })),
    today,
  })
})
