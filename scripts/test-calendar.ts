/**
 * Integration tests for the calendar-feed Edge Function (ICS calendar feed).
 *
 * Covers:
 *  - Public access by per-user feed token (no JWT) → valid VCALENDAR
 *  - Feed includes the user's tasks (with due_date) and notes (with due_at)
 *  - Tasks/notes without due dates are excluded
 *  - Unknown token → 404; missing token → 400
 *  - Token isolation: Bob's token never exposes Alice's items
 *
 * Run:  npx tsx scripts/test-calendar.ts
 * (Requires the local stack running with the calendar-feed function served.)
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const FEED = `${SUPABASE_URL}/functions/v1/calendar-feed`

let passed = 0, failed = 0
function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✓  ${label}`); passed++ }
  else        { console.error(`  ✗  ${label}  →  ${JSON.stringify(value)}`); failed++ }
}
function section(title: string) { console.log(`\n── ${title} ──`) }

function client() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
}
async function signIn(c: ReturnType<typeof client>, email: string, pw: string) {
  const { error } = await c.auth.signInWithPassword({ email, password: pw })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

// Fetch the feed with no auth header at all — exactly how a calendar client polls.
async function fetchFeed(token: string | null) {
  const url = token === null ? FEED : `${FEED}?token=${encodeURIComponent(token)}`
  return fetch(url)
}

async function main() {
  console.log("JustDoIt — calendar-feed (ICS) tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const { data: aliceProfile } = await alice.from("profiles").select("id").single()
  const aliceId = aliceProfile!.id

  const createdListIds: string[] = []
  const createdTaskIds: string[] = []
  const createdNoteIds: string[] = []

  const aliceToken = "test" + Math.random().toString(36).slice(2) + Date.now().toString(36)
  const bobToken   = "test" + Math.random().toString(36).slice(2) + Date.now().toString(36)

  // ── Setup: Alice's dated items + feed token ────────────────────────────────
  section("Setup")

  const { data: list } = await alice
    .from("todo_lists").insert({ title: "Calendar Test List" }).select().single()
  ok("Alice creates a list", !!list)
  if (list) createdListIds.push(list.id)

  const { data: datedTask } = await alice
    .from("tasks")
    .insert({ list_id: list!.id, title: "ICS dated task", due_date: "2026-06-25", due_time: "14:30:00" })
    .select().single()
  ok("Alice creates a task with a due date", !!datedTask)
  if (datedTask) createdTaskIds.push(datedTask.id)

  const { data: undatedTask } = await alice
    .from("tasks")
    .insert({ list_id: list!.id, title: "ICS undated task" })
    .select().single()
  if (undatedTask) createdTaskIds.push(undatedTask.id)

  const { data: datedNote } = await alice
    .from("notes")
    .insert({ title: "ICS dated note", content: "x", due_at: "2026-06-26T09:00:00Z" })
    .select().single()
  ok("Alice creates a note with a due date", !!datedNote)
  if (datedNote) createdNoteIds.push(datedNote.id)

  // Merge tokens into each user's profile.settings (RLS: own row update).
  const { data: aProf } = await alice.from("profiles").select("settings").eq("id", aliceId).single()
  await alice.from("profiles")
    .update({ settings: { ...(aProf?.settings as object ?? {}), calendar_feed_token: aliceToken } as never })
    .eq("id", aliceId)
  const { data: bobProfile } = await bob.from("profiles").select("id, settings").single()
  await bob.from("profiles")
    .update({ settings: { ...(bobProfile?.settings as object ?? {}), calendar_feed_token: bobToken } as never })
    .eq("id", bobProfile!.id)
  ok("Feed tokens stored in profile settings", true)

  // ── Feed contents ──────────────────────────────────────────────────────────
  section("Feed contents")

  const res = await fetchFeed(aliceToken)
  ok("Feed returns 200", res.status === 200)
  ok("Content-Type is text/calendar", (res.headers.get("content-type") ?? "").includes("text/calendar"))
  const body = await res.text()
  ok("Body is a VCALENDAR", body.startsWith("BEGIN:VCALENDAR") && body.trimEnd().endsWith("END:VCALENDAR"))
  ok("Includes the dated task", body.includes("ICS dated task"))
  ok("Includes the dated note", body.includes("ICS dated note"))
  ok("Excludes the undated task", !body.includes("ICS undated task"))
  ok("Dated task is an all-day-or-timed VEVENT", body.includes(`UID:task-${datedTask!.id}@justdoit`))
  ok("Task due time rendered (floating local)", body.includes("DTSTART:20260625T143000"))
  ok("Note due_at rendered (UTC)", body.includes("DTSTART:20260626T090000Z"))

  // ── Token isolation ─────────────────────────────────────────────────────────
  section("Token isolation & errors")

  const bobRes = await fetchFeed(bobToken)
  const bobBody = await bobRes.text()
  ok("Bob's feed succeeds", bobRes.status === 200)
  ok("Bob's feed does NOT contain Alice's task", !bobBody.includes("ICS dated task"))
  ok("Bob's feed does NOT contain Alice's note", !bobBody.includes("ICS dated note"))

  const unknownRes = await fetchFeed("definitely-not-a-real-token")
  ok("Unknown token → 404", unknownRes.status === 404)

  const missingRes = await fetchFeed(null)
  ok("Missing token → 400", missingRes.status === 400)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  section("Cleanup")

  if (createdTaskIds.length) await alice.from("tasks").delete().in("id", createdTaskIds)
  if (createdNoteIds.length) await alice.from("notes").delete().in("id", createdNoteIds)
  if (createdListIds.length) await alice.from("todo_lists").delete().in("id", createdListIds)
  // Remove the test tokens.
  await alice.from("profiles").update({ settings: { ...(aProf?.settings as object ?? {}) } as never }).eq("id", aliceId)
  await bob.from("profiles").update({ settings: { ...(bobProfile?.settings as object ?? {}) } as never }).eq("id", bobProfile!.id)
  ok("Cleaned up test data", true)

  console.log(`\n${"─".repeat(44)}`)
  console.log(`  Tests passed: ${passed}`)
  if (failed > 0) { console.error(`  Tests FAILED: ${failed}`); process.exit(1) }
  else            { console.log("  All tests passed ✓") }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })
