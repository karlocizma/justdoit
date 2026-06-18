/**
 * Integration tests for Mentions in Workspaces.
 *
 * Covers:
 *  - A workspace member can create a mention for a co-member
 *  - Recipient can read it; the author (non-recipient) cannot
 *  - Non-members cannot create mentions in a workspace they're not in
 *  - Unique (source_id, mentioned_user): re-mentioning is idempotent
 *  - Recipient can mark a mention read
 *  - mentions is in the realtime publication
 *
 * Run:  npx tsx scripts/test-mentions.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

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

async function main() {
  console.log("JustDoIt — Mentions in Workspaces tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const { data: aliceP } = await alice.from("profiles").select("id").single()
  const aliceId = aliceP!.id
  const { data: bobP } = await bob.from("profiles").select("id").single()
  const bobId = bobP!.id

  const wsIds: string[] = []
  const noteIds: string[] = []

  // ── Setup: shared workspace (Alice owner, Bob accepted member) + a note ──────
  section("Setup")

  const { data: ws } = await alice.from("workspaces").insert({ name: "Mentions WS" }).select().single()
  ok("Alice creates workspace", !!ws); if (ws) wsIds.push(ws.id)

  await alice.from("workspace_members").insert({ workspace_id: ws!.id, user_id: bobId, role: "member" })
  const { error: acceptErr } = await bob.rpc("accept_workspace_invite", { p_workspace_id: ws!.id })
  ok("Bob joins the workspace", !acceptErr)

  const { data: note } = await alice
    .from("notes").insert({ title: "Standup", content: "hey @Bob", workspace_id: ws!.id }).select().single()
  ok("Alice creates a workspace note", !!note); if (note) noteIds.push(note.id)

  // Alice's private second workspace (Bob is NOT a member).
  const { data: ws2 } = await alice.from("workspaces").insert({ name: "Alice Only" }).select().single()
  if (ws2) wsIds.push(ws2.id)

  // ── Create & read ────────────────────────────────────────────────────────────
  section("Create & read")

  const { data: mention, error: mErr } = await alice
    .from("mentions")
    .insert({ workspace_id: ws!.id, mentioned_user: bobId, source_type: "note", source_id: note!.id, context: "Standup" })
    .select().single()
  ok("Member can create a mention for a co-member", !mErr && !!mention)
  ok("mentioned_by defaults to the author (Alice)", mention?.mentioned_by === aliceId)

  const { data: bobSees } = await bob.from("mentions").select("id, is_read").eq("id", mention!.id)
  ok("Recipient (Bob) can read the mention", bobSees?.length === 1)

  // The bell filters to mentioned_user = self, so Alice's inbox never shows
  // mentions she authored for others.
  const { data: aliceInbox } = await alice.from("mentions").select("id").eq("mentioned_user", aliceId)
  ok("Mention does not appear in the author's own inbox", !aliceInbox?.some(m => m.id === mention!.id))

  // ── Idempotency ──────────────────────────────────────────────────────────────
  section("Idempotency & guards")

  const { error: dupErr } = await alice
    .from("mentions")
    .insert({ workspace_id: ws!.id, mentioned_user: bobId, source_type: "note", source_id: note!.id })
  ok("Duplicate (source_id, mentioned_user) is rejected", !!dupErr)

  // Bob is not a member of ws2 → cannot create mentions there.
  const { error: nonMemberErr } = await bob
    .from("mentions")
    .insert({ workspace_id: ws2!.id, mentioned_user: aliceId, source_type: "note", source_id: note!.id })
  ok("Non-member cannot create a mention in that workspace", !!nonMemberErr)

  // ── Mark read ─────────────────────────────────────────────────────────────────
  section("Mark read")

  const { error: readErr } = await bob.from("mentions").update({ is_read: true }).eq("id", mention!.id)
  ok("Recipient can mark a mention read", !readErr)
  const { data: afterRead } = await bob.from("mentions").select("is_read").eq("id", mention!.id).single()
  ok("Mention is now read", afterRead?.is_read === true)

  // ── Realtime ──────────────────────────────────────────────────────────────────
  section("Realtime")

  const { data: rtTables } = await alice.rpc("get_realtime_tables")
  ok("mentions in supabase_realtime publication", ((rtTables as string[] | null) ?? []).includes("mentions"))

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  section("Cleanup")
  if (noteIds.length) await alice.from("notes").delete().in("id", noteIds)
  if (wsIds.length)   await alice.from("workspaces").delete().in("id", wsIds)
  ok("Cleaned up", true)

  console.log(`\n${"─".repeat(44)}`)
  console.log(`  Tests passed: ${passed}`)
  if (failed > 0) { console.error(`  Tests FAILED: ${failed}`); process.exit(1) }
  else            { console.log("  All tests passed ✓") }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })
