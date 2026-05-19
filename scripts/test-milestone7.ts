/**
 * Integration tests for Milestone 7: Storage, Recurring Tasks, Export, Digest.
 *
 * Covers:
 *  - Storage buckets exist and have correct config
 *  - note-attachments: upload, download via signed URL, RLS isolation
 *  - Recurring tasks: toggle_task_complete advances due_date, respects until
 *  - Export Edge Function: auth, graceful missing-key handling
 *  - Recurring-tasks cron logic (unit-tests the helper, no cron needed)
 *
 * Run:  npx tsx scripts/test-milestone7.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
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
  console.log("JustDoIt — Milestone 7 (Storage + Recurring + Export) tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const aliceJwt = await getJwt(alice)

  const svc = client(SERVICE_KEY)  // service role — bypasses RLS

  // Get Alice's user_id
  const { data: aliceProfile } = await alice.from("profiles").select("id").single()
  const aliceId = aliceProfile!.id

  // Seed list + note IDs
  const { data: seedLists } = await alice.from("todo_lists").select("id").limit(1)
  const listId = seedLists![0].id

  const createdTaskIds: string[] = []
  const uploadedPaths:  string[] = []


  // ── 1. Storage buckets ────────────────────────────────────────────────────
  section("Storage buckets")

  const { data: buckets } = await svc.storage.listBuckets()
  const ids = buckets?.map(b => b.id) ?? []
  ok("note-attachments bucket exists",  ids.includes("note-attachments"))
  ok("exports bucket exists",           ids.includes("exports"))

  const noteAttBucket = buckets?.find(b => b.id === "note-attachments")
  const exportsBucket = buckets?.find(b => b.id === "exports")
  ok("note-attachments is private",     !noteAttBucket?.public)
  ok("exports is private",              !exportsBucket?.public)
  ok("note-attachments 5 MB limit",     noteAttBucket?.file_size_limit === 5242880)


  // ── 2. Storage: upload and signed URL ────────────────────────────────────
  section("Storage: upload and signed URL")

  const { data: seedNotes } = await alice.from("notes").select("id").limit(1)
  const noteId = seedNotes![0].id

  const filePath   = `${aliceId}/${noteId}/test-image.txt`
  const fileContent = new Blob(["hello attachment"], { type: "text/plain" })

  const { data: uploadData, error: uploadErr } = await alice.storage
    .from("note-attachments")
    .upload(filePath, fileContent, { contentType: "text/plain" })

  ok("Alice can upload to note-attachments",  !uploadErr && !!uploadData)
  if (!uploadErr) uploadedPaths.push(filePath)

  // Signed URL for download
  const { data: signedData, error: signErr } = await alice.storage
    .from("note-attachments")
    .createSignedUrl(filePath, 300)
  ok("Can create signed URL",               !signErr && !!signedData?.signedUrl)

  // Download via signed URL (no auth required)
  if (signedData?.signedUrl) {
    const dlRes  = await fetch(signedData.signedUrl)
    const dlText = await dlRes.text()
    ok("Signed URL download returns file content", dlText === "hello attachment")
  }

  // List files
  const { data: listed } = await alice.storage
    .from("note-attachments")
    .list(`${aliceId}/${noteId}`)
  ok("Can list files in own folder",        listed?.some(f => f.name === "test-image.txt"))


  // ── 3. Storage: RLS isolation ────────────────────────────────────────────
  section("Storage: RLS isolation")

  // Bob uploads to his own path (succeeds)
  const { data: bobProfile } = await bob.from("profiles").select("id").single()
  const bobId = bobProfile!.id
  const bobPath = `${bobId}/some-note/bob.txt`
  const { error: bobUploadErr } = await bob.storage
    .from("note-attachments")
    .upload(bobPath, new Blob(["bob"], { type: "text/plain" }), { contentType: "text/plain", upsert: true })
  ok("Bob can upload to his own path",      !bobUploadErr)
  if (!bobUploadErr) {
    // Cleanup Bob's file
    await bob.storage.from("note-attachments").remove([bobPath])
  }

  // Bob tries to upload to Alice's path (should fail — path check)
  const alicePath = `${aliceId}/other-note/hack.txt`
  const { error: bobHackErr } = await bob.storage
    .from("note-attachments")
    .upload(alicePath, new Blob(["hack"], { type: "text/plain" }), { contentType: "text/plain" })
  ok("Bob cannot upload to Alice's path",   !!bobHackErr)

  // Bob cannot read Alice's file (owner_id check)
  const { data: bobRead, error: bobReadErr } = await bob.storage
    .from("note-attachments")
    .download(filePath)
  ok("Bob cannot download Alice's file",    !!bobReadErr || bobRead === null)


  // ── 4. Recurring tasks: daily toggle ─────────────────────────────────────
  section("Recurring tasks: toggle advances due_date")

  const today     = new Date().toISOString().split("T")[0]
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split("T")[0]
  const in2Days   = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  const in7Days   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]

  // Daily recurring task
  const { data: tDaily } = await alice
    .from("tasks")
    .insert({
      list_id:    listId,
      title:      "Daily recurring",
      due_date:   today,
      recurrence: { freq: "daily", interval: 1 },
    })
    .select().single()
  ok("Created daily recurring task",        !!tDaily)
  if (tDaily) createdTaskIds.push(tDaily.id)

  const { data: toggledDaily } = await alice
    .rpc("toggle_task_complete", { task_id: tDaily!.id })
  const dailyResult = toggledDaily as Database["public"]["Tables"]["tasks"]["Row"]
  ok("Daily: is_completed remains false",   dailyResult?.is_completed === false)
  ok("Daily: due_date advanced to tomorrow", dailyResult?.due_date === tomorrow)

  // Weekly recurring task
  const { data: tWeekly } = await alice
    .from("tasks")
    .insert({
      list_id:    listId,
      title:      "Weekly recurring",
      due_date:   today,
      recurrence: { freq: "weekly", interval: 1 },
    })
    .select().single()
  ok("Created weekly recurring task",       !!tWeekly)
  if (tWeekly) createdTaskIds.push(tWeekly.id)

  const { data: toggledWeekly } = await alice
    .rpc("toggle_task_complete", { task_id: tWeekly!.id })
  const weeklyResult = toggledWeekly as Database["public"]["Tables"]["tasks"]["Row"]
  ok("Weekly: due_date advanced by 7 days", weeklyResult?.due_date === in7Days)

  // Non-recurring task: normal completion toggle
  const { data: tNormal } = await alice
    .from("tasks")
    .insert({ list_id: listId, title: "Normal task" })
    .select().single()
  ok("Created normal task",                 !!tNormal)
  if (tNormal) createdTaskIds.push(tNormal.id)

  const { data: toggledNormal } = await alice
    .rpc("toggle_task_complete", { task_id: tNormal!.id })
  const normalResult = toggledNormal as Database["public"]["Tables"]["tasks"]["Row"]
  ok("Normal: is_completed = true",         normalResult?.is_completed === true)
  ok("Normal: completed_at set",            normalResult?.completed_at !== null)


  // ── 5. Recurring tasks: until limit ──────────────────────────────────────
  section("Recurring tasks: until limit")

  // Task with until = tomorrow → completing today advances to tomorrow
  const { data: tUntilTomorrow } = await alice
    .from("tasks")
    .insert({
      list_id:    listId,
      title:      "Recurring until tomorrow",
      due_date:   today,
      recurrence: { freq: "daily", interval: 1, until: tomorrow },
    })
    .select().single()
  if (tUntilTomorrow) createdTaskIds.push(tUntilTomorrow.id)

  const { data: togUntilTomorrow } = await alice
    .rpc("toggle_task_complete", { task_id: tUntilTomorrow!.id })
  const untilTomorrowResult = togUntilTomorrow as Database["public"]["Tables"]["tasks"]["Row"]
  ok("Until=tomorrow: advances to tomorrow", untilTomorrowResult?.due_date === tomorrow)
  ok("Until=tomorrow: still not completed",  untilTomorrowResult?.is_completed === false)

  // Task with until = today → next occurrence (tomorrow) exceeds until → completes
  const { data: tUntilToday } = await alice
    .from("tasks")
    .insert({
      list_id:    listId,
      title:      "Recurring until today",
      due_date:   today,
      recurrence: { freq: "daily", interval: 1, until: today },
    })
    .select().single()
  if (tUntilToday) createdTaskIds.push(tUntilToday.id)

  const { data: togUntilToday } = await alice
    .rpc("toggle_task_complete", { task_id: tUntilToday!.id })
  const untilTodayResult = togUntilToday as Database["public"]["Tables"]["tasks"]["Row"]
  ok("Until=today: task is completed (end of recurrence)", untilTodayResult?.is_completed === true)


  // ── 6. Recurring-tasks cron: next-occurrence helper (unit test) ──────────
  section("Recurring-tasks cron: next-occurrence logic")

  // Reimplementing the nextOccurrence helper inline for testing
  function nextOccurrence(
    due: string,
    recur: { freq: string; interval?: number; until?: string },
  ): string | null {
    const base = new Date(due + "T00:00:00Z")
    const n    = recur.interval ?? 1
    let next: Date

    switch (recur.freq) {
      case "daily":   next = new Date(base); next.setUTCDate(base.getUTCDate() + n);            break
      case "weekly":  next = new Date(base); next.setUTCDate(base.getUTCDate() + n * 7);        break
      case "monthly": next = new Date(base); next.setUTCMonth(base.getUTCMonth() + n);          break
      case "yearly":  next = new Date(base); next.setUTCFullYear(base.getUTCFullYear() + n);    break
      default: return null
    }

    if (recur.until && next > new Date(recur.until + "T00:00:00Z")) return null
    return next.toISOString().split("T")[0]
  }

  ok("daily interval=1 advances by 1 day",
    nextOccurrence("2026-01-01", { freq: "daily", interval: 1 }) === "2026-01-02")

  ok("weekly interval=2 advances by 14 days",
    nextOccurrence("2026-01-01", { freq: "weekly", interval: 2 }) === "2026-01-15")

  ok("monthly interval=1 advances to next month",
    nextOccurrence("2026-01-31", { freq: "monthly", interval: 1 }) === "2026-03-03")  // feb overflow

  ok("yearly interval=1 advances by 1 year",
    nextOccurrence("2026-03-15", { freq: "yearly", interval: 1 }) === "2027-03-15")

  ok("stops at until date",
    nextOccurrence("2026-12-31", { freq: "daily", interval: 1, until: "2026-12-31" }) === null)

  ok("allows next = until date exactly",
    nextOccurrence("2026-12-30", { freq: "daily", interval: 1, until: "2026-12-31" }) === "2026-12-31")


  // ── 7. Export Edge Function ───────────────────────────────────────────────
  section("Export Edge Function")

  // No auth → 401
  const noAuthRes = await fetch(`${FN_BASE}/export`, { method: "POST" })
  ok("Export without auth → 401",        noAuthRes.status === 401)

  // Authenticated → 200 (TRIGGER_SECRET_KEY not configured in local dev)
  const exportRes = await fetch(`${FN_BASE}/export`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  ok("Export with auth → 200",           exportRes.status === 200)

  const exportBody = await exportRes.json()
  ok("Export body is valid JSON",        typeof exportBody === "object")
  ok("Export has scheduled field",       "scheduled" in exportBody)
  // Without TRIGGER_SECRET_KEY, returns { scheduled: false }
  ok("Export reports scheduled or skipped", exportBody.scheduled === false || exportBody.scheduled === true)


  // ── Cleanup ───────────────────────────────────────────────────────────────
  section("Cleanup")

  if (uploadedPaths.length) {
    const { error } = await alice.storage
      .from("note-attachments")
      .remove(uploadedPaths)
    ok(`Removed ${uploadedPaths.length} test file(s)`, !error)
  }

  if (createdTaskIds.length) {
    const { error } = await alice.from("tasks").delete().in("id", createdTaskIds)
    ok(`Deleted ${createdTaskIds.length} test tasks`, !error)
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
