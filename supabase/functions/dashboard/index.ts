/**
 * GET /functions/v1/dashboard
 *
 * Returns an aggregate of the authenticated user's data in a single round-trip:
 *   notes  — total, pinned, archived, in_trash
 *   tasks  — total, completed, due_today, overdue
 *   lists  — active lists with per-list task_count and completed_count
 *   recent_notes — last 5 notes by updated_at
 *
 * All queries run in parallel; RLS enforces user isolation automatically.
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const today = new Date().toISOString().split("T")[0]

  // Five parallel queries — all filtered by auth.uid() via RLS.
  const [noteStats, trashCount, taskStats, lists, recentNotes] = await Promise.all([
    // Active notes with enough columns to compute pinned/archived counts in JS
    supabase
      .from("notes")
      .select("is_pinned, is_archived", { count: "exact" })
      .is("deleted_at", null),

    // Trash count only (head=true → no rows, just count)
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),

    // All tasks with enough columns to bucket due/overdue/completed in JS
    supabase
      .from("tasks")
      .select("list_id, is_completed, due_date"),

    // Non-archived lists ordered for sidebar display
    supabase
      .from("todo_lists")
      .select("id, title, icon, color, sort_order")
      .eq("is_archived", false)
      .order("sort_order"),

    // Most recently updated active notes (preview cards)
    supabase
      .from("notes")
      .select("id, title, color, is_pinned, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
  ])

  const firstError = [
    noteStats.error,
    trashCount.error,
    taskStats.error,
    lists.error,
    recentNotes.error,
  ].find(Boolean)

  if (firstError) {
    return new Response(JSON.stringify({ error: firstError.message }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const allNotes = noteStats.data ?? []
  const allTasks = taskStats.data ?? []

  const body = {
    notes: {
      total:    noteStats.count ?? 0,
      pinned:   allNotes.filter(n => n.is_pinned).length,
      archived: allNotes.filter(n => n.is_archived).length,
      in_trash: trashCount.count ?? 0,
    },
    tasks: {
      total:     allTasks.length,
      completed: allTasks.filter(t => t.is_completed).length,
      due_today: allTasks.filter(t => !t.is_completed && t.due_date === today).length,
      overdue:   allTasks.filter(t => !t.is_completed && t.due_date !== null && t.due_date < today).length,
    },
    lists: (lists.data ?? []).map(list => ({
      ...list,
      task_count:      allTasks.filter(t => t.list_id === list.id).length,
      completed_count: allTasks.filter(t => t.list_id === list.id && t.is_completed).length,
    })),
    recent_notes: recentNotes.data ?? [],
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
})
