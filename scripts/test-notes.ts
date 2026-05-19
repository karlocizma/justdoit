/**
 * Integration tests for Notes + Tags API (Milestone 3).
 *
 * Covers:
 *  - Note CRUD via PostgREST
 *  - Tag CRUD via PostgREST
 *  - note_tags associations (attach / detach)
 *  - Filtering: active, pinned, archived, by tag (RPC)
 *  - Full-text search via search_all RPC
 *  - Reorder via reorder_notes RPC
 *  - Soft delete + trash view + restore
 *  - Pagination with exact count
 *  - RLS isolation (Bob cannot touch Alice's data)
 *
 * Run:  npx tsx scripts/test-notes.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✓  ${label}`); passed++ }
  else        { console.error(`  ✗  ${label}  →  ${JSON.stringify(value)}`); failed++ }
}

function section(title: string) { console.log(`\n── ${title} ──`) }

function client() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function signIn(c: ReturnType<typeof client>, email: string, password: string) {
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("JustDoIt — Notes & Tags integration tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  // Track created IDs so we can clean up regardless of test outcome.
  const createdNoteIds: string[] = []
  const createdTagIds:  string[] = []

  try {

    // ── 1. Create notes ─────────────────────────────────────────────────────
    section("Create notes")

    const { data: n1, error: e1 } = await alice
      .from("notes")
      .insert({ title: "Test Note Alpha", content: "Content about alpha testing." })
      .select().single()
    ok("Create note returns the new row",    !e1 && !!n1)
    ok("Default is_pinned = false",          n1?.is_pinned === false)
    ok("Default is_archived = false",        n1?.is_archived === false)
    ok("Default deleted_at = null",          n1?.deleted_at === null)
    if (n1) createdNoteIds.push(n1.id)

    const { data: n2 } = await alice
      .from("notes")
      .insert({ title: "Test Note Beta", content: "Beta content for searching.", color: "#6c63ff" })
      .select().single()
    ok("Create note with color",             n2?.color === "#6c63ff")
    if (n2) createdNoteIds.push(n2.id)

    const { data: n3 } = await alice
      .from("notes")
      .insert({ title: "Test Note Gamma", content: "Gamma note to archive." })
      .select().single()
    ok("Third note created",                 !!n3)
    if (n3) createdNoteIds.push(n3.id)


    // ── 2. Read / List ───────────────────────────────────────────────────────
    section("List notes")

    const { data: allNotes, count } = await alice
      .from("notes")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
    // Seed has 2 notes, we added 3
    ok("Active notes count is 5 (2 seed + 3 test)",  count === 5)

    const { data: withTags } = await alice
      .from("notes")
      .select("id, title, note_tags(tag_id)")
      .is("deleted_at", null)
      .order("sort_order")
    ok("Select with embedded note_tags works",        Array.isArray(withTags))


    // ── 3. Update notes ──────────────────────────────────────────────────────
    section("Update notes")

    const t0 = n1!.updated_at
    await new Promise(r => setTimeout(r, 50)) // ensure clock ticks

    const { data: updated, error: upErr } = await alice
      .from("notes")
      .update({ title: "Test Note Alpha (edited)", color: "#48d1cc" })
      .eq("id", n1!.id)
      .select().single()
    ok("Update returns updated row",          !upErr && !!updated)
    ok("Title was changed",                   updated?.title === "Test Note Alpha (edited)")
    ok("Color was changed",                   updated?.color === "#48d1cc")
    ok("updated_at trigger fired",            updated?.updated_at !== t0)

    // Pin
    const { data: pinned } = await alice
      .from("notes")
      .update({ is_pinned: true })
      .eq("id", n1!.id)
      .select("is_pinned").single()
    ok("Pin note",                            pinned?.is_pinned === true)

    // Archive n3
    const { data: archived } = await alice
      .from("notes")
      .update({ is_archived: true })
      .eq("id", n3!.id)
      .select("is_archived").single()
    ok("Archive note",                        archived?.is_archived === true)

    // Unarchive
    const { data: unarchived } = await alice
      .from("notes")
      .update({ is_archived: false })
      .eq("id", n3!.id)
      .select("is_archived").single()
    ok("Unarchive note",                      unarchived?.is_archived === false)


    // ── 4. Tags CRUD ─────────────────────────────────────────────────────────
    section("Tags CRUD")

    const { data: tag1, error: te1 } = await alice
      .from("tags")
      .insert({ name: "test-tagA", color: "#ff6b6b" })
      .select().single()
    ok("Create tag returns row",              !te1 && !!tag1)
    ok("Tag name is set",                     tag1?.name === "test-tagA")
    if (tag1) createdTagIds.push(tag1.id)

    const { data: tag2 } = await alice
      .from("tags")
      .insert({ name: "test-tagB" })
      .select().single()
    ok("Create tag without color",            !!tag2 && tag2.color === null)
    if (tag2) createdTagIds.push(tag2.id)

    const { data: renamedTag } = await alice
      .from("tags")
      .update({ name: "test-tagA-renamed", color: "#4caf89" })
      .eq("id", tag1!.id)
      .select().single()
    ok("Rename and recolor tag",              renamedTag?.name === "test-tagA-renamed")

    const { data: allTags } = await alice.from("tags").select("*")
    // Seed has 3 tags (work, ideas, personal), we added 2
    ok("Tag list includes new tags",          (allTags?.length ?? 0) >= 2)


    // ── 5. note_tags associations ────────────────────────────────────────────
    section("Note-tag associations")

    const { error: attachErr1 } = await alice
      .from("note_tags")
      .insert({ note_id: n1!.id, tag_id: tag1!.id })
    ok("Attach tag1 to n1",                   !attachErr1)

    const { error: attachErr2 } = await alice
      .from("note_tags")
      .insert({ note_id: n1!.id, tag_id: tag2!.id })
    ok("Attach tag2 to n1",                   !attachErr2)

    const { error: attachErr3 } = await alice
      .from("note_tags")
      .insert({ note_id: n2!.id, tag_id: tag1!.id })
    ok("Attach tag1 to n2",                   !attachErr3)

    // Verify join
    const { data: noteWithTags } = await alice
      .from("notes")
      .select("id, note_tags(tag_id, tags(name))")
      .eq("id", n1!.id)
      .single()
    const tagCount = (noteWithTags?.note_tags as unknown[])?.length ?? 0
    ok("n1 has 2 tags via join",              tagCount === 2)

    // Duplicate attach should fail (unique PK)
    const { error: dupErr } = await alice
      .from("note_tags")
      .insert({ note_id: n1!.id, tag_id: tag1!.id })
    ok("Duplicate attach is rejected",        !!dupErr)

    // Detach one tag
    const { error: detachErr } = await alice
      .from("note_tags")
      .delete()
      .eq("note_id", n1!.id)
      .eq("tag_id", tag2!.id)
    ok("Detach tag2 from n1",                 !detachErr)

    const { data: afterDetach } = await alice
      .from("notes")
      .select("id, note_tags(tag_id)")
      .eq("id", n1!.id)
      .single()
    ok("n1 now has 1 tag",                    (afterDetach?.note_tags as unknown[])?.length === 1)

    // Cross-user attach should be blocked by RLS
    const { error: crossUserErr } = await bob
      .from("note_tags")
      .insert({ note_id: n1!.id, tag_id: tag1!.id })
    ok("Bob cannot attach to Alice's note",   !!crossUserErr)


    // ── 6. Filter by tag (RPC) ───────────────────────────────────────────────
    section("Filter notes by tag (get_notes_by_tag RPC)")

    const { data: byTag, error: byTagErr } = await alice
      .rpc("get_notes_by_tag", { p_tag_id: tag1!.id })
    ok("get_notes_by_tag returns array",      !byTagErr && Array.isArray(byTag))
    // n1 and n2 both have tag1
    ok("Returns 2 notes with tag1",           byTag?.length === 2)
    ok("Only returns non-deleted notes",      byTag?.every((n: Row<"notes">) => n.deleted_at === null))


    // ── 7. Full-text search ──────────────────────────────────────────────────
    section("Full-text search (search_all RPC)")

    const { data: searchRes, error: searchErr } = await alice
      .rpc("search_all", { query: "alpha" })
    ok("search_all returns results",          !searchErr && Array.isArray(searchRes))
    ok("Finds note by title keyword",         searchRes?.some((r: { title: string }) => r.title.toLowerCase().includes("alpha")))
    ok("Results have kind discriminator",     searchRes?.every((r: { kind: string }) => r.kind === "note" || r.kind === "task"))

    const { data: searchRes2 } = await alice.rpc("search_all", { query: "beta" })
    ok("Finds note by content keyword",       searchRes2?.some((r: { kind: string }) => r.kind === "note"))

    // Bob's search returns only Bob's data
    const { data: bobSearch } = await bob.rpc("search_all", { query: "alpha" })
    ok("Bob's search returns 0 results",      bobSearch?.length === 0)


    // ── 8. Reorder ───────────────────────────────────────────────────────────
    section("Reorder notes (reorder_notes RPC)")

    const { error: reorderErr } = await alice.rpc("reorder_notes", {
      updates: [
        { id: n1!.id, sort_order: 10 },
        { id: n2!.id, sort_order: 20 },
        { id: n3!.id, sort_order: 30 },
      ],
    })
    ok("reorder_notes succeeds",              !reorderErr)

    const { data: reordered } = await alice
      .from("notes")
      .select("id, sort_order")
      .in("id", [n1!.id, n2!.id, n3!.id])
      .order("sort_order")
    ok("sort_order updated for all 3 notes",  reordered?.length === 3)
    ok("Correct order: n1(10), n2(20), n3(30)",
      reordered?.[0]?.id === n1!.id &&
      reordered?.[1]?.id === n2!.id &&
      reordered?.[2]?.id === n3!.id
    )

    // Bob cannot reorder Alice's notes
    const { error: bobReorderErr } = await bob.rpc("reorder_notes", {
      updates: [{ id: n1!.id, sort_order: 99 }],
    })
    // RPC is security definer with auth.uid() check — Bob's call silently affects 0 rows
    ok("Bob's reorder call doesn't throw",    !bobReorderErr)
    const { data: afterBobReorder } = await alice
      .from("notes").select("sort_order").eq("id", n1!.id).single()
    ok("n1 sort_order unchanged after Bob's call", afterBobReorder?.sort_order === 10)


    // ── 9. Soft delete + trash + restore ────────────────────────────────────
    section("Soft delete, trash, restore")

    const { error: softDelErr } = await alice
      .from("notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", n2!.id)
    ok("Soft delete (PATCH deleted_at)",       !softDelErr)

    // Active list should no longer include n2
    const { data: activeAfterDel } = await alice
      .from("notes")
      .select("id")
      .is("deleted_at", null)
      .in("id", createdNoteIds)
    ok("Soft-deleted note not in active list", !activeAfterDel?.some(n => n.id === n2!.id))

    // Trash view
    const { data: trash, error: trashErr } = await alice
      .rpc("get_notes_in_trash")
    ok("get_notes_in_trash returns trashed notes", !trashErr && trash?.some((n: Row<"notes">) => n.id === n2!.id))

    // Restore
    const { data: restored, error: restoreErr } = await alice
      .rpc("restore_note", { note_id: n2!.id })
    ok("restore_note succeeds",               !restoreErr && !!restored)
    ok("Restored note has null deleted_at",   (restored as Row<"notes">)?.deleted_at === null)

    const { data: activeAfterRestore } = await alice
      .from("notes")
      .select("id")
      .is("deleted_at", null)
      .eq("id", n2!.id)
    ok("Restored note is back in active list", activeAfterRestore?.length === 1)

    // Bob cannot restore Alice's note
    const { error: bobRestoreErr } = await bob
      .rpc("restore_note", { note_id: n1!.id })
    ok("Bob cannot restore Alice's note",     !!bobRestoreErr)


    // ── 10. Pagination ───────────────────────────────────────────────────────
    section("Pagination")

    const { data: page1, count: total } = await alice
      .from("notes")
      .select("id, title", { count: "exact" })
      .is("deleted_at", null)
      .order("sort_order")
      .range(0, 1)  // first 2 rows

    ok("Page 1 returns exactly 2 rows",       page1?.length === 2)
    ok("Exact count reflects total active notes", (total ?? 0) === 5)

    const { data: page2 } = await alice
      .from("notes")
      .select("id, title")
      .is("deleted_at", null)
      .order("sort_order")
      .range(2, 3)  // rows 3-4

    ok("Page 2 returns 2 different rows",     page2?.length === 2)
    ok("Pages don't overlap",
      !page1?.some(a => page2?.some(b => b.id === a.id)))


    // ── 11. RLS — Bob cannot touch Alice's notes ─────────────────────────────
    section("RLS isolation")

    // Read
    const { data: bobNotes } = await bob
      .from("notes")
      .select("id")
      .in("id", createdNoteIds)
    ok("Bob reads 0 of Alice's notes",        bobNotes?.length === 0)

    // Update (affects 0 rows, no error — PostgREST returns empty array)
    const { data: bobUpdate } = await bob
      .from("notes")
      .update({ title: "hacked" })
      .eq("id", n1!.id)
      .select()
    ok("Bob's update returns 0 affected rows", bobUpdate?.length === 0)

    // Verify title unchanged
    const { data: checkTitle } = await alice
      .from("notes")
      .select("title")
      .eq("id", n1!.id)
      .single()
    ok("Alice's note title unchanged after Bob's update attempt",
      checkTitle?.title === "Test Note Alpha (edited)")

    // Insert with Alice's user_id bypassed by RLS with check
    const { data: aliceUserId } = await alice
      .from("profiles")
      .select("id")
      .single()
    const { error: injectErr } = await bob
      .from("notes")
      .insert({ title: "injected", user_id: aliceUserId!.id })
    ok("Bob cannot insert note as Alice (RLS with check)", !!injectErr)

    // Hard DELETE on Alice's note → 0 rows affected
    const { data: bobDel } = await bob
      .from("notes")
      .delete()
      .eq("id", n1!.id)
      .select()
    ok("Bob's DELETE returns 0 affected rows", bobDel?.length === 0)

    // Verify note still exists
    const { data: stillExists } = await alice
      .from("notes")
      .select("id")
      .eq("id", n1!.id)
      .single()
    ok("Alice's note still exists after Bob's DELETE", !!stillExists)

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    section("Cleanup")

    if (createdNoteIds.length) {
      const { error } = await alice
        .from("notes")
        .delete()
        .in("id", createdNoteIds)
      ok(`Deleted ${createdNoteIds.length} test notes`, !error)
    }

    if (createdTagIds.length) {
      const { error } = await alice
        .from("tags")
        .delete()
        .in("id", createdTagIds)
      ok(`Deleted ${createdTagIds.length} test tags`, !error)
    }

    // Verify seed notes still exist
    const { count: seedCount } = await alice
      .from("notes")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
    ok("Seed notes intact (2 remain)", seedCount === 2)

    // ── Summary ────────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(44)}`)
    console.log(`  Tests passed: ${passed}`)
    if (failed > 0) {
      console.error(`  Tests FAILED: ${failed}`)
      process.exit(1)
    } else {
      console.log("  All tests passed ✓")
    }
  }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })
