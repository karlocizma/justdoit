/**
 * Integration tests for To-Do Lists + Tasks API (Milestone 4).
 *
 * Covers:
 *  - List CRUD (create, read, update, archive, reorder)
 *  - Task CRUD (create, read, update, delete)
 *  - Sub-tasks (parent_id)
 *  - Priority filtering
 *  - Completion toggle via toggle_task_complete RPC
 *  - Cascade deletes (list → tasks)
 *  - Reorder tasks via reorder_tasks RPC
 *  - RLS isolation (Bob cannot touch Alice's data)
 *
 * Run:  npx tsx scripts/test-tasks.ts
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

async function signIn(c: ReturnType<typeof client>, email: string, password: string) {
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("JustDoIt — To-Do Lists & Tasks integration tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const createdListIds: string[] = []

  try {

    // ── 1. Create lists ──────────────────────────────────────────────────────
    section("Create lists")

    const { data: l1, error: le1 } = await alice
      .from("todo_lists")
      .insert({ title: "Test List Alpha", icon: "🧪", color: "#6c63ff" })
      .select().single()
    ok("Create list returns new row",           !le1 && !!l1)
    ok("Default is_archived = false",           l1?.is_archived === false)
    ok("Icon stored correctly",                 l1?.icon === "🧪")
    ok("Color stored correctly",                l1?.color === "#6c63ff")
    if (l1) createdListIds.push(l1.id)

    const { data: l2 } = await alice
      .from("todo_lists")
      .insert({ title: "Test List Beta" })
      .select().single()
    ok("Create list without optional fields",   !!l2)
    if (l2) createdListIds.push(l2.id)

    // List used only for cascade-delete test — track separately
    const { data: lCascade } = await alice
      .from("todo_lists")
      .insert({ title: "Cascade Delete List" })
      .select().single()
    ok("Create cascade-delete list",            !!lCascade)


    // ── 2. Read / List ───────────────────────────────────────────────────────
    section("List lists")

    const { data: allLists, count: listCount } = await alice
      .from("todo_lists")
      .select("*", { count: "exact" })
    // Seed has 2 lists (Inbox, Work), we added 3
    ok("Total list count is 5 (2 seed + 3 test)", listCount === 5)

    const { data: active } = await alice
      .from("todo_lists")
      .select("*")
      .eq("is_archived", false)
    ok("All created lists are not archived",    active?.length === 5)


    // ── 3. Update list ───────────────────────────────────────────────────────
    section("Update list")

    const { data: updatedList, error: ulErr } = await alice
      .from("todo_lists")
      .update({ title: "Test List Alpha (renamed)", color: "#48d1cc" })
      .eq("id", l1!.id)
      .select().single()
    ok("Update returns updated row",            !ulErr && !!updatedList)
    ok("Title changed",                         updatedList?.title === "Test List Alpha (renamed)")
    ok("Color changed",                         updatedList?.color === "#48d1cc")

    // Archive
    const { data: archived } = await alice
      .from("todo_lists")
      .update({ is_archived: true })
      .eq("id", l1!.id)
      .select("is_archived").single()
    ok("Archive list",                          archived?.is_archived === true)

    // Unarchive
    const { data: unarchived } = await alice
      .from("todo_lists")
      .update({ is_archived: false })
      .eq("id", l1!.id)
      .select("is_archived").single()
    ok("Unarchive list",                        unarchived?.is_archived === false)


    // ── 4. Reorder lists ─────────────────────────────────────────────────────
    section("Reorder lists (reorder_todo_lists RPC)")

    const { error: reorderListErr } = await alice.rpc("reorder_todo_lists", {
      updates: [
        { id: l1!.id, sort_order: 10 },
        { id: l2!.id, sort_order: 20 },
      ],
    })
    ok("reorder_todo_lists succeeds",           !reorderListErr)

    const { data: reorderedLists } = await alice
      .from("todo_lists")
      .select("id, sort_order")
      .in("id", [l1!.id, l2!.id])
      .order("sort_order")
    ok("Lists sort_order updated",              reorderedLists?.[0]?.id === l1!.id && reorderedLists?.[1]?.id === l2!.id)


    // ── 5. Create tasks ──────────────────────────────────────────────────────
    section("Create tasks")

    const today = new Date().toISOString().split("T")[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]

    const { data: t1, error: te1 } = await alice
      .from("tasks")
      .insert({
        list_id: l1!.id,
        title: "Test Task One",
        priority: 3,
        due_date: today,
        notes: "Some task notes",
      })
      .select().single()
    ok("Create task returns new row",           !te1 && !!t1)
    ok("Default is_completed = false",          t1?.is_completed === false)
    ok("Default completed_at = null",           t1?.completed_at === null)
    ok("Priority stored",                       t1?.priority === 3)
    ok("Due date stored",                       t1?.due_date === today)
    ok("Notes stored",                          t1?.notes === "Some task notes")

    const { data: t2 } = await alice
      .from("tasks")
      .insert({ list_id: l1!.id, title: "Test Task Two", priority: 1, due_date: tomorrow })
      .select().single()
    ok("Second task created",                   !!t2)

    const { data: t3 } = await alice
      .from("tasks")
      .insert({ list_id: l2!.id, title: "Test Task Three (in l2)", priority: 2 })
      .select().single()
    ok("Task in second list created",           !!t3)


    // ── 6. Sub-tasks ─────────────────────────────────────────────────────────
    section("Sub-tasks")

    const { data: sub1, error: subErr } = await alice
      .from("tasks")
      .insert({ list_id: l1!.id, title: "Sub-task of t1", parent_id: t1!.id })
      .select().single()
    ok("Create sub-task returns row",           !subErr && !!sub1)
    ok("Sub-task parent_id set",                sub1?.parent_id === t1!.id)
    ok("Sub-task shares same list",             sub1?.list_id === t1!.list_id)

    // Query sub-tasks of t1
    const { data: subTasks } = await alice
      .from("tasks")
      .select("id, title, parent_id")
      .eq("parent_id", t1!.id)
    ok("Can query sub-tasks by parent_id",      subTasks?.length === 1 && subTasks[0].id === sub1!.id)

    // Parent with children embedded
    const { data: parentWithSubs } = await alice
      .from("tasks")
      .select("id, title, tasks!parent_id(id, title)")
      .eq("id", t1!.id)
      .single()
    const subCount = (parentWithSubs?.tasks as unknown[])?.length ?? 0
    ok("Parent task embeds sub-tasks",          subCount === 1)

    // Invalid parent_id (cross-list) should be allowed at DB level (parent_id only requires same table)
    // but cascade delete should work: deleting parent removes sub-task
    const { error: delParentErr } = await alice
      .from("tasks")
      .delete()
      .eq("id", t1!.id)
    ok("Delete parent task succeeds",           !delParentErr)

    const { data: orphan } = await alice
      .from("tasks")
      .select("id")
      .eq("id", sub1!.id)
    ok("Sub-task cascade-deleted with parent",  orphan?.length === 0)


    // ── 7. Read tasks with filters ───────────────────────────────────────────
    section("Task filters")

    // Create a few more tasks for filtering tests
    const { data: highPri } = await alice
      .from("tasks")
      .insert({ list_id: l1!.id, title: "High priority task", priority: 3, due_date: today })
      .select().single()
    const { data: lowPri } = await alice
      .from("tasks")
      .insert({ list_id: l1!.id, title: "Low priority task", priority: 1 })
      .select().single()
    const { data: noPri } = await alice
      .from("tasks")
      .insert({ list_id: l1!.id, title: "No priority task", priority: 0 })
      .select().single()

    // Filter by priority >= 2
    const { data: highPriTasks } = await alice
      .from("tasks")
      .select("id, priority")
      .eq("list_id", l1!.id)
      .gte("priority", 2)
    ok("Filter by priority >= 2",              highPriTasks?.every(t => t.priority >= 2))
    ok("High priority count correct",          highPriTasks?.length === 1) // t1 deleted in sub-task section; only highPri(3) remains

    // Filter by due_date = today
    const { data: dueToday } = await alice
      .from("tasks")
      .select("id, due_date")
      .eq("list_id", l1!.id)
      .eq("due_date", today)
    ok("Filter by due_date returns correct tasks", dueToday?.every(t => t.due_date === today))

    // Filter incomplete only
    const { data: incomplete } = await alice
      .from("tasks")
      .select("id")
      .eq("list_id", l1!.id)
      .eq("is_completed", false)
    ok("Filter incomplete tasks",              incomplete && incomplete.length > 0)

    // Embedded tasks on list
    const { data: listWithTasks } = await alice
      .from("todo_lists")
      .select("id, title, tasks(id, title, is_completed)")
      .eq("id", l1!.id)
      .single()
    const taskCount = (listWithTasks?.tasks as unknown[])?.length ?? 0
    ok("List embeds tasks correctly",          taskCount > 0)


    // ── 8. Update tasks ──────────────────────────────────────────────────────
    section("Update tasks")

    const { data: updatedTask, error: utErr } = await alice
      .from("tasks")
      .update({ title: "Test Task Two (edited)", priority: 3, notes: "Updated notes" })
      .eq("id", t2!.id)
      .select().single()
    ok("Update returns updated row",           !utErr && !!updatedTask)
    ok("Title changed",                        updatedTask?.title === "Test Task Two (edited)")
    ok("Priority changed",                     updatedTask?.priority === 3)

    // Move task to different list
    const { data: moved } = await alice
      .from("tasks")
      .update({ list_id: l2!.id })
      .eq("id", t2!.id)
      .select("list_id").single()
    ok("Move task to different list",          moved?.list_id === l2!.id)

    // Move it back
    await alice.from("tasks").update({ list_id: l1!.id }).eq("id", t2!.id)


    // ── 9. Toggle completion (RPC) ───────────────────────────────────────────
    section("Toggle task completion (RPC)")

    const { data: toggled, error: togErr } = await alice
      .rpc("toggle_task_complete", { task_id: t2!.id })
    ok("toggle_task_complete returns task",    !togErr && !!toggled)
    ok("is_completed flipped to true",         (toggled as Row<"tasks">)?.is_completed === true)
    ok("completed_at set on completion",       (toggled as Row<"tasks">)?.completed_at !== null)

    // Toggle back to incomplete
    const { data: toggled2 } = await alice
      .rpc("toggle_task_complete", { task_id: t2!.id })
    ok("Toggle back to incomplete",            (toggled2 as Row<"tasks">)?.is_completed === false)
    ok("completed_at cleared on uncompletion", (toggled2 as Row<"tasks">)?.completed_at === null)

    // Toggling non-existent task throws
    const { error: noTaskErr } = await alice
      .rpc("toggle_task_complete", { task_id: "00000000-0000-0000-0000-000000000099" })
    ok("Toggle non-existent task throws",      !!noTaskErr)


    // ── 10. Reorder tasks ────────────────────────────────────────────────────
    section("Reorder tasks (reorder_tasks RPC)")

    // Get all tasks in l1
    const { data: l1Tasks } = await alice
      .from("tasks")
      .select("id")
      .eq("list_id", l1!.id)
      .order("sort_order")

    ok("l1 has tasks to reorder",              (l1Tasks?.length ?? 0) >= 2)

    if ((l1Tasks?.length ?? 0) >= 2) {
      const ta = l1Tasks![0]
      const tb = l1Tasks![1]

      const { error: reorderErr } = await alice.rpc("reorder_tasks", {
        p_list_id: l1!.id,
        updates: [
          { id: ta.id, sort_order: 100 },
          { id: tb.id, sort_order: 200 },
        ],
      })
      ok("reorder_tasks succeeds",             !reorderErr)

      const { data: afterReorder } = await alice
        .from("tasks")
        .select("id, sort_order")
        .in("id", [ta.id, tb.id])
        .order("sort_order")
      ok("Tasks reordered correctly",          afterReorder?.[0]?.id === ta.id && afterReorder?.[0]?.sort_order === 100)
    }

    // Bob cannot reorder Alice's tasks (wrong list owner)
    const { error: bobReorderTaskErr } = await bob.rpc("reorder_tasks", {
      p_list_id: l1!.id,
      updates: [{ id: t2!.id, sort_order: 999 }],
    })
    ok("Bob's reorder throws (not his list)",  !!bobReorderTaskErr)


    // ── 11. Cascade delete: list → tasks ────────────────────────────────────
    section("Cascade delete")

    // Add a task to lCascade
    const { data: cascadeTask } = await alice
      .from("tasks")
      .insert({ list_id: lCascade!.id, title: "Will be cascade deleted" })
      .select().single()
    ok("Task added to cascade-delete list",    !!cascadeTask)

    const { error: delListErr } = await alice
      .from("todo_lists")
      .delete()
      .eq("id", lCascade!.id)
    ok("Delete list succeeds",                 !delListErr)

    const { data: orphanTask } = await alice
      .from("tasks")
      .select("id")
      .eq("id", cascadeTask!.id)
    ok("Task cascade-deleted with list",       orphanTask?.length === 0)


    // ── 12. RLS isolation ────────────────────────────────────────────────────
    section("RLS isolation")

    // Bob reads Alice's lists — expects 0
    const { data: bobLists } = await bob
      .from("todo_lists")
      .select("id")
      .in("id", createdListIds)
    ok("Bob reads 0 of Alice's lists",         bobLists?.length === 0)

    // Bob reads Alice's tasks — expects 0
    const { data: bobTasks } = await bob
      .from("tasks")
      .select("id")
      .in("id", [t2!.id])
    ok("Bob reads 0 of Alice's tasks",         bobTasks?.length === 0)

    // Bob updates Alice's list — 0 rows affected
    const { data: bobListUpdate } = await bob
      .from("todo_lists")
      .update({ title: "hacked" })
      .eq("id", l1!.id)
      .select()
    ok("Bob's list update returns 0 rows",     bobListUpdate?.length === 0)

    // Bob tries toggle_task_complete on Alice's task
    const { error: bobToggleErr } = await bob
      .rpc("toggle_task_complete", { task_id: t2!.id })
    ok("Bob cannot toggle Alice's task",       !!bobToggleErr)

    // Bob deletes Alice's list — 0 rows affected
    const { data: bobDelList } = await bob
      .from("todo_lists")
      .delete()
      .eq("id", l1!.id)
      .select()
    ok("Bob's list DELETE returns 0 rows",     bobDelList?.length === 0)

    // Verify l1 still exists
    const { data: stillExists } = await alice
      .from("todo_lists")
      .select("id")
      .eq("id", l1!.id)
      .single()
    ok("Alice's list still exists",            !!stillExists)

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    section("Cleanup")

    if (createdListIds.length) {
      // Tasks cascade-deleted with lists
      const { error } = await alice
        .from("todo_lists")
        .delete()
        .in("id", createdListIds)
      ok(`Deleted ${createdListIds.length} test lists (tasks cascade)`, !error)
    }

    // Verify seed lists still exist
    const { count: seedCount } = await alice
      .from("todo_lists")
      .select("*", { count: "exact" })
    ok("Seed lists intact (2 remain)", seedCount === 2)

    // Verify seed tasks still exist
    const { count: seedTaskCount } = await alice
      .from("tasks")
      .select("*", { count: "exact" })
    ok("Seed tasks intact (5 remain)", seedTaskCount === 5)

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
