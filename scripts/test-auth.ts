/**
 * Smoke-tests for the auth flow and RLS isolation.
 *
 * Prerequisites:
 *   supabase start (local stack running)
 *   npm install (from project root)
 *
 * Run:
 *   npx tsx scripts/test-auth.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL     = "http://127.0.0.1:14321"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(label: string, value: unknown) {
  if (value) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}  →  got: ${JSON.stringify(value)}`)
    failed++
  }
}

function section(title: string) {
  console.log(`\n── ${title} ──`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("JustDoIt — Auth & RLS smoke tests\n")

  const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

  // ── 1. Sign in as Alice ───────────────────────────────────────────────────
  section("Sign in")
  const { data: aliceAuth, error: aliceErr } =
    await anonClient.auth.signInWithPassword({
      email:    "alice@example.com",
      password: "password123",
    })

  ok("Alice can sign in",     !aliceErr && !!aliceAuth.session)
  ok("Alice has a JWT",       !!aliceAuth.session?.access_token)
  ok("Alice has a user ID",   !!aliceAuth.user?.id)

  const aliceClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${aliceAuth.session!.access_token}` } },
  })

  // ── 2. Profile ────────────────────────────────────────────────────────────
  section("Profile (RLS: allow own row)")
  const { data: profile, error: profileErr } = await aliceClient
    .from("profiles")
    .select("*")
    .eq("id", aliceAuth.user!.id)
    .single()

  ok("Can read own profile",           !profileErr && !!profile)
  ok("display_name is Alice",          profile?.display_name === "Alice")

  // ── 3. Notes ─────────────────────────────────────────────────────────────
  section("Notes (RLS: own rows only)")
  const { data: notes, error: notesErr } = await aliceClient
    .from("notes")
    .select("*, note_tags(tag_id, tags(name))")
    .order("sort_order")

  ok("Alice's notes are returned",     !notesErr && Array.isArray(notes))
  ok("Has 2 notes",                    notes?.length === 2)
  ok("First note is pinned",           notes?.[0]?.is_pinned === true)
  ok("Second note has 2 tags",         (notes?.[1]?.note_tags as unknown[])?.length === 2)

  // ── 4. To-do lists + tasks ────────────────────────────────────────────────
  section("To-do lists & tasks")
  const { data: lists, error: listsErr } = await aliceClient
    .from("todo_lists")
    .select("id, title, tasks(id, title, priority, is_completed)")
    .order("sort_order")

  ok("Alice has 2 lists",              !listsErr && lists?.length === 2)
  ok("Inbox has tasks",                (lists?.[0]?.tasks as unknown[])?.length > 0)

  // ── 5. RLS isolation — sign in as Bob ─────────────────────────────────────
  section("RLS isolation (Bob cannot see Alice's data)")
  const { data: bobAuth, error: bobErr } =
    await anonClient.auth.signInWithPassword({
      email:    "bob@example.com",
      password: "password123",
    })

  ok("Bob can sign in",                !bobErr && !!bobAuth.session)

  const bobClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bobAuth.session!.access_token}` } },
  })

  const { data: bobNotes } = await bobClient.from("notes").select("*")
  ok("Bob sees 0 notes (RLS blocks Alice's)", bobNotes?.length === 0)

  const { data: bobProfiles } = await bobClient
    .from("profiles")
    .select("id")
    .neq("id", bobAuth.user!.id)
  ok("Bob cannot read Alice's profile",  bobProfiles?.length === 0)

  // ── 6. RPC: toggle_task_complete ──────────────────────────────────────────
  section("RPC: toggle_task_complete")
  const firstTask = (lists?.[0]?.tasks as Array<{ id: string; is_completed: boolean }>)?.[0]

  if (firstTask) {
    const { data: toggled, error: toggleErr } = await aliceClient
      .rpc("toggle_task_complete", { task_id: firstTask.id })
    ok("toggle_task_complete returns a task",   !toggleErr && !!toggled)
    ok("is_completed was flipped",              (toggled as { is_completed: boolean })?.is_completed !== firstTask.is_completed)

    // Bob cannot toggle Alice's task
    const { error: bobToggleErr } = await bobClient
      .rpc("toggle_task_complete", { task_id: firstTask.id })
    ok("Bob cannot toggle Alice's task (denied)", !!bobToggleErr)

    // Restore original state so subsequent test runs start from a known baseline
    await aliceClient.rpc("toggle_task_complete", { task_id: firstTask.id })
  } else {
    ok("Skipped toggle test — no tasks found", false)
  }

  // ── 7. Unauthenticated access ─────────────────────────────────────────────
  section("Unauthenticated access (anon client)")
  const { data: anonNotes, error: anonErr } = await anonClient
    .from("notes")
    .select("*")

  ok("Anon client gets 0 notes",       !anonErr && anonNotes?.length === 0)

  // ── 8. Sign out ───────────────────────────────────────────────────────────
  section("Sign out")
  const { error: signOutErr } = await aliceClient.auth.signOut()
  ok("Alice signed out",               !signOutErr)

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

main().catch((err) => {
  console.error("Unhandled error:", err)
  process.exit(1)
})
