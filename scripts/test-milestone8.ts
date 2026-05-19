/**
 * Integration tests for Milestone 8: Realtime, Shared Workspaces.
 *
 * Covers:
 *  - Realtime: supabase_realtime publication includes notes, tasks, todo_lists, workspace_members
 *  - Workspace CRUD (create, read, update, delete)
 *  - Workspace owner auto-membership trigger
 *  - workspace-invite Edge Function: auth, validation, invite flow
 *  - accept_workspace_invite RPC
 *  - RLS: workspace members can read/write shared notes and lists
 *  - RLS: non-members and pending invitees cannot see workspace content
 *  - Profiles: co-members can read each other's display names
 *
 * Run:  npx tsx scripts/test-milestone8.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const FN_BASE = `${SUPABASE_URL}/functions/v1`

// ── Harness ───────────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✓  ${label}`); passed++ }
  else        { console.error(`  ✗  ${label}  →  ${JSON.stringify(value)}`); failed++ }
}

function section(title: string) { console.log(`\n── ${title} ──`) }

function client(key = ANON_KEY) {
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false } })
}

async function signIn(c: ReturnType<typeof client>, email: string, pw: string) {
  const { error } = await c.auth.signInWithPassword({ email, password: pw })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

async function getJwt(c: ReturnType<typeof client>) {
  return (await c.auth.getSession()).data.session!.access_token
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("JustDoIt — Milestone 8 (Realtime + Workspaces) tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const aliceJwt = await getJwt(alice)

  const { data: aliceProfile } = await alice.from("profiles").select("id").single()
  const aliceId = aliceProfile!.id
  const { data: bobProfile }   = await bob.from("profiles").select("id").single()
  const bobId = bobProfile!.id

  const createdWorkspaceIds: string[] = []
  const createdNoteIds:      string[] = []
  const createdListIds:      string[] = []
  const createdTaskIds:      string[] = []


  // ── 1. Realtime publication ────────────────────────────────────────────────
  section("Realtime publication")

  const { data: rtTables, error: rtErr } = await alice.rpc("get_realtime_tables")
  ok("get_realtime_tables RPC succeeds",          !rtErr)

  const tables = (rtTables as string[] | null) ?? []
  ok("notes in supabase_realtime publication",          tables.includes("notes"))
  ok("tasks in supabase_realtime publication",          tables.includes("tasks"))
  ok("todo_lists in supabase_realtime publication",     tables.includes("todo_lists"))
  ok("workspace_members in supabase_realtime publication", tables.includes("workspace_members"))


  // ── 2. Workspace CRUD ─────────────────────────────────────────────────────
  section("Workspace CRUD")

  // Create
  const { data: ws1, error: wsCreateErr } = await alice
    .from("workspaces")
    .insert({ name: "Alice's Team" })
    .select().single()
  ok("Alice can create a workspace",            !wsCreateErr && !!ws1)
  ok("Workspace owner_id = Alice",              ws1?.owner_id === aliceId)
  if (ws1) createdWorkspaceIds.push(ws1.id)

  // Owner auto-membership via trigger
  const { data: ownerMember } = await alice
    .from("workspace_members")
    .select("role, accepted_at")
    .eq("workspace_id", ws1!.id)
    .eq("user_id", aliceId)
    .single()
  ok("Alice auto-added as owner member",        ownerMember?.role === "owner")
  ok("Alice's membership is pre-accepted",      ownerMember?.accepted_at !== null)

  // Read
  const { data: wsList } = await alice.from("workspaces").select("id, name")
  ok("Alice can read her workspace",            wsList?.some(w => w.id === ws1!.id))

  // Update
  const { error: wsUpdateErr } = await alice
    .from("workspaces")
    .update({ name: "Alice's Updated Team" })
    .eq("id", ws1!.id)
  ok("Alice can update her workspace",          !wsUpdateErr)

  // Bob cannot read Alice's workspace (not a member yet)
  const { data: bobWsList } = await bob.from("workspaces").select("id")
  ok("Bob cannot see workspace before invite",  !bobWsList?.some(w => w.id === ws1!.id))


  // ── 3. Workspace invite Flow ──────────────────────────────────────────────
  section("Workspace invite flow")

  // No auth → 401
  const noAuthRes = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id, email: "bob@example.com" }),
  })
  ok("workspace-invite without auth → 401",     noAuthRes.status === 401)

  // Missing fields → 400
  const badBodyRes = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aliceJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id }),  // missing email
  })
  ok("workspace-invite missing email → 400",    badBodyRes.status === 400)

  // Non-member cannot invite
  const bobJwt    = await getJwt(bob)
  const nonMember = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bobJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id, email: "alice@example.com" }),
  })
  ok("Non-member cannot invite → 403",          nonMember.status === 403)

  // Unknown email → 404
  const unknownRes = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aliceJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id, email: "ghost@example.com" }),
  })
  ok("Unknown email → 404",                     unknownRes.status === 404)

  // Valid invite — Alice invites Bob
  const inviteRes = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aliceJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id, email: "bob@example.com" }),
  })
  ok("Valid invite → 201",                      inviteRes.status === 201)
  const inviteBody = await inviteRes.json()
  ok("Invite response has user_id",             !!inviteBody.user_id)
  ok("Invite response user_id = Bob",           inviteBody.user_id === bobId)

  // Duplicate invite → already_member
  const dupRes = await fetch(`${FN_BASE}/workspace-invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aliceJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: ws1!.id, email: "bob@example.com" }),
  })
  ok("Duplicate invite → 200 already_member",   dupRes.status === 200)
  const dupBody = await dupRes.json()
  ok("Duplicate invite body has already_member", dupBody.already_member === true)

  // Bob can see his pending invite row
  const { data: bobInvite } = await bob
    .from("workspace_members")
    .select("role, accepted_at")
    .eq("workspace_id", ws1!.id)
    .eq("user_id", bobId)
    .single()
  ok("Bob can see his pending invite",          !!bobInvite)
  ok("Bob's invite is pending (not accepted)",  bobInvite?.accepted_at === null)

  // Bob can see the workspace info (pending member)
  const { data: pendingWs } = await bob.from("workspaces").select("id, name").eq("id", ws1!.id).single()
  ok("Bob (pending) can see workspace info",    !!pendingWs)

  // Bob cannot yet see workspace notes (not accepted)
  const { data: ws1Note } = await alice
    .from("notes")
    .insert({ title: "Shared Note", content: "workspace content", workspace_id: ws1!.id })
    .select().single()
  ok("Alice creates note in workspace",         !!ws1Note)
  if (ws1Note) createdNoteIds.push(ws1Note.id)

  const { data: bobNotesBeforeAccept } = await bob
    .from("notes")
    .select("id")
    .eq("id", ws1Note!.id)
  ok("Bob cannot see note before accepting invite", !bobNotesBeforeAccept?.length)

  // Bob accepts the invite
  const { error: acceptErr } = await bob.rpc("accept_workspace_invite", {
    p_workspace_id: ws1!.id,
  })
  ok("Bob accepts workspace invite",            !acceptErr)

  // Verify accepted_at is set
  const { data: acceptedMember } = await bob
    .from("workspace_members")
    .select("accepted_at")
    .eq("workspace_id", ws1!.id)
    .eq("user_id", bobId)
    .single()
  ok("Bob's membership is now accepted",        !!acceptedMember?.accepted_at)


  // ── 4. Shared notes RLS ───────────────────────────────────────────────────
  section("Shared notes RLS")

  // Bob can now see the workspace note
  const { data: bobNotesAfterAccept } = await bob
    .from("notes")
    .select("id")
    .eq("id", ws1Note!.id)
  ok("Bob can see note after accepting invite", bobNotesAfterAccept?.length === 1)

  // Bob can create a note in the workspace
  const { data: bobNote, error: bobNoteErr } = await bob
    .from("notes")
    .insert({ title: "Bob's Workspace Note", content: "bob content", workspace_id: ws1!.id })
    .select().single()
  ok("Bob can create note in workspace",        !bobNoteErr && !!bobNote)
  if (bobNote) createdNoteIds.push(bobNote.id)

  // Alice can see Bob's workspace note
  const { data: aliceSeesBobNote } = await alice
    .from("notes")
    .select("id")
    .eq("id", bobNote!.id)
  ok("Alice can see Bob's workspace note",      aliceSeesBobNote?.length === 1)

  // Bob's personal notes are NOT visible to Alice
  const { data: bobPersonalNotes } = await bob
    .from("notes")
    .select("id")
    .is("workspace_id", null)
    .eq("user_id", bobId)
  const bobPersonalNoteIds = bobPersonalNotes?.map(n => n.id) ?? []

  if (bobPersonalNoteIds.length > 0) {
    const { data: aliceSeesPersonal } = await alice
      .from("notes")
      .select("id")
      .in("id", bobPersonalNoteIds)
    ok("Alice cannot see Bob's personal notes", !aliceSeesPersonal?.length)
  } else {
    ok("(skipped: Bob has no personal notes)", true)
  }

  // Workspace isolation: Alice creates a second workspace, Bob is NOT in it
  const { data: ws2 } = await alice
    .from("workspaces")
    .insert({ name: "Alice Private" })
    .select().single()
  if (ws2) createdWorkspaceIds.push(ws2.id)

  const { data: ws2Note } = await alice
    .from("notes")
    .insert({ title: "Private Note", content: "only for alice", workspace_id: ws2!.id })
    .select().single()
  if (ws2Note) createdNoteIds.push(ws2Note.id)

  const { data: bobSeesWs2Note } = await bob
    .from("notes")
    .select("id")
    .eq("id", ws2Note!.id)
  ok("Bob cannot see notes in non-joined workspace", !bobSeesWs2Note?.length)

  // Bob cannot create notes in Alice's private workspace
  const { error: bobHackErr } = await bob
    .from("notes")
    .insert({ title: "Hack", content: "intrusion", workspace_id: ws2!.id })
  ok("Bob cannot create note in non-joined workspace", !!bobHackErr)


  // ── 5. Shared lists and tasks RLS ─────────────────────────────────────────
  section("Shared lists and tasks RLS")

  // Alice creates a list in workspace 1
  const { data: wsList1, error: wsListErr } = await alice
    .from("todo_lists")
    .insert({ title: "Shared List", workspace_id: ws1!.id })
    .select().single()
  ok("Alice creates list in workspace",         !wsListErr && !!wsList1)
  if (wsList1) createdListIds.push(wsList1.id)

  // Bob can see the workspace list
  const { data: bobSeesWsList } = await bob
    .from("todo_lists")
    .select("id")
    .eq("id", wsList1!.id)
  ok("Bob can see workspace list",              bobSeesWsList?.length === 1)

  // Bob can create a task in the workspace list
  const { data: bobTask, error: bobTaskErr } = await bob
    .from("tasks")
    .insert({ list_id: wsList1!.id, title: "Bob's workspace task" })
    .select().single()
  ok("Bob can create task in workspace list",   !bobTaskErr && !!bobTask)
  if (bobTask) createdTaskIds.push(bobTask.id)

  // Alice can see Bob's workspace task
  const { data: aliceSeesBobTask } = await alice
    .from("tasks")
    .select("id")
    .eq("id", bobTask!.id)
  ok("Alice can see Bob's workspace task",      aliceSeesBobTask?.length === 1)

  // Bob cannot create a task in Alice's private workspace list
  const { data: privateList } = await alice
    .from("todo_lists")
    .insert({ title: "Alice Private List", workspace_id: ws2!.id })
    .select().single()
  if (privateList) createdListIds.push(privateList.id)

  const { error: bobHackTaskErr } = await bob
    .from("tasks")
    .insert({ list_id: privateList!.id, title: "Hack task" })
  ok("Bob cannot create task in non-joined workspace list", !!bobHackTaskErr)


  // ── 6. Profiles: co-members can see each other ────────────────────────────
  section("Profiles: co-member visibility")

  // Bob can now see Alice's profile (they share a workspace)
  const { data: aliceProfileData } = await bob
    .from("profiles")
    .select("id, display_name")
    .eq("id", aliceId)
    .single()
  ok("Bob can see Alice's profile (co-member)", !!aliceProfileData?.display_name)

  // Alice can see Bob's profile
  const { data: bobProfileData } = await alice
    .from("profiles")
    .select("id, display_name")
    .eq("id", bobId)
    .single()
  ok("Alice can see Bob's profile (co-member)", !!bobProfileData?.display_name)

  // Workspace member list visible to both
  const { data: members } = await alice
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", ws1!.id)
  ok("Alice sees both members of workspace",    members?.length === 2)


  // ── 7. Workspace delete ───────────────────────────────────────────────────
  section("Workspace management")

  // Bob cannot delete Alice's workspace
  const { error: bobDeleteWsErr } = await bob
    .from("workspaces")
    .delete()
    .eq("id", ws1!.id)
  // The delete won't error — it just returns 0 rows affected
  const { data: wsStillExists } = await alice.from("workspaces").select("id").eq("id", ws1!.id).single()
  ok("Bob cannot delete Alice's workspace",     !!wsStillExists)

  // Member can leave workspace
  const { error: leaveErr } = await bob
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ws1!.id)
    .eq("user_id", bobId)
  ok("Bob can leave the workspace",             !leaveErr)

  const { data: afterLeave } = await bob
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", ws1!.id)
    .eq("user_id", bobId)
  ok("Bob's membership row removed after leave", !afterLeave?.length)


  // ── Cleanup ───────────────────────────────────────────────────────────────
  section("Cleanup")

  if (createdTaskIds.length) {
    const { error } = await alice.from("tasks").delete().in("id", createdTaskIds)
    ok(`Deleted ${createdTaskIds.length} test task(s)`, !error)
  }
  if (createdNoteIds.length) {
    const { error } = await alice.from("notes").delete().in("id", createdNoteIds)
    ok(`Deleted ${createdNoteIds.length} test note(s)`, !error)
  }
  if (createdListIds.length) {
    const { error } = await alice.from("todo_lists").delete().in("id", createdListIds)
    ok(`Deleted ${createdListIds.length} test list(s)`, !error)
  }
  // Delete workspaces (cascades to members, notes/lists lose workspace_id via set null)
  if (createdWorkspaceIds.length) {
    const { error } = await alice.from("workspaces").delete().in("id", createdWorkspaceIds)
    ok(`Deleted ${createdWorkspaceIds.length} test workspace(s)`, !error)
  }


  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(44)}`)
  console.log(`  Tests passed: ${passed}`)
  if (failed > 0) {
    console.error(`  Tests FAILED: ${failed}`)
    process.exit(1)
  } else {
    console.log("  All tests passed ✓")
  }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })
