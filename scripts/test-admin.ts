/**
 * Integration tests for the admin dashboard (admin-stats Edge Function + global
 * admin role).
 *
 * Covers:
 *  - Unauthenticated → 401
 *  - Non-admin (Bob) → 403
 *  - Admin (Alice, seeded is_admin = true) → 200 with the expected stats shape
 *  - Privilege escalation: a user cannot flip their own is_admin
 *
 * Run:  npx tsx scripts/test-admin.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const FN = `${SUPABASE_URL}/functions/v1/admin-stats`

let passed = 0, failed = 0
function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✓  ${label}`); passed++ }
  else        { console.error(`  ✗  ${label}  →  ${JSON.stringify(value)}`); failed++ }
}
function section(t: string) { console.log(`\n── ${t} ──`) }

function client() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
}
async function signIn(c: ReturnType<typeof client>, email: string, pw: string) {
  const { error } = await c.auth.signInWithPassword({ email, password: pw })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}
async function jwt(c: ReturnType<typeof client>) {
  return (await c.auth.getSession()).data.session!.access_token
}

async function main() {
  console.log("JustDoIt — admin dashboard tests\n")

  const alice = client()  // seeded is_admin = true
  const bob   = client()  // not an admin
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  section("Access control")

  const noAuth = await fetch(FN)
  ok("Unauthenticated → 401", noAuth.status === 401)

  const bobRes = await fetch(FN, { headers: { Authorization: `Bearer ${await jwt(bob)}` } })
  ok("Non-admin (Bob) → 403", bobRes.status === 403)

  const aliceRes = await fetch(FN, { headers: { Authorization: `Bearer ${await jwt(alice)}` } })
  ok("Admin (Alice) → 200", aliceRes.status === 200)

  section("Stats shape")

  const stats = await aliceRes.json()
  ok("users.total ≥ 2",            typeof stats.users?.total === "number" && stats.users.total >= 2)
  ok("users.new_last_7d present",  typeof stats.users?.new_last_7d === "number")
  ok("notes block present",        typeof stats.notes?.total === "number" && typeof stats.notes?.in_trash === "number")
  ok("tasks block present",        typeof stats.tasks?.total === "number" && typeof stats.tasks?.completed === "number")
  ok("workspaces block present",   typeof stats.workspaces?.total === "number" && typeof stats.workspaces?.active === "number")
  ok("recent_signups is an array", Array.isArray(stats.recent_signups))

  section("Privilege escalation guard")

  const { data: bobProfile } = await bob.from("profiles").select("id, is_admin").single()
  ok("Bob starts as non-admin", bobProfile?.is_admin === false)

  // Bob tries to make himself an admin via a normal profile update.
  await bob.from("profiles").update({ is_admin: true }).eq("id", bobProfile!.id)
  const { data: afterEscalation } = await bob.from("profiles").select("is_admin").eq("id", bobProfile!.id).single()
  ok("Bob cannot self-escalate to admin", afterEscalation?.is_admin === false)

  // And the function still rejects him.
  const bobRetry = await fetch(FN, { headers: { Authorization: `Bearer ${await jwt(bob)}` } })
  ok("Non-admin still → 403 after attempt", bobRetry.status === 403)

  console.log(`\n${"─".repeat(44)}`)
  console.log(`  Tests passed: ${passed}`)
  if (failed > 0) { console.error(`  Tests FAILED: ${failed}`); process.exit(1) }
  else            { console.log("  All tests passed ✓") }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })
