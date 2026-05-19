/**
 * recurring-tasks.daily — Trigger.dev v3 scheduled task
 *
 * Runs every day at 01:00 UTC as a safety net for recurring tasks whose
 * due_date fell in the past without being toggled via the client.
 *
 * Logic:
 *   1. Find all tasks with recurrence != null, due_date < today, is_completed = false
 *   2. For each, calculate the next occurrence date
 *   3. Advance due_date to the next occurrence (rolling-date model)
 *
 * This covers "ignored" recurring tasks so they stay relevant.
 * The primary path (user completing a task) is handled by toggle_task_complete.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { schedules } from "@trigger.dev/sdk/v3"
import { createClient } from "@supabase/supabase-js"

interface Recurrence {
  freq:     "daily" | "weekly" | "monthly" | "yearly"
  interval?: number
  until?:   string  // ISO date string
}

function nextOccurrence(currentDue: string, recurrence: Recurrence): Date | null {
  const base     = new Date(currentDue + "T00:00:00Z")
  const n        = recurrence.interval ?? 1
  let   next: Date

  switch (recurrence.freq) {
    case "daily":   next = new Date(base); next.setUTCDate(base.getUTCDate() + n); break
    case "weekly":  next = new Date(base); next.setUTCDate(base.getUTCDate() + n * 7); break
    case "monthly": next = new Date(base); next.setUTCMonth(base.getUTCMonth() + n); break
    case "yearly":  next = new Date(base); next.setUTCFullYear(base.getUTCFullYear() + n); break
    default:        return null
  }

  if (recurrence.until && next > new Date(recurrence.until + "T00:00:00Z")) return null
  return next
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0]
}

export const recurringTasksDaily = schedules.task({
  id: "recurring-tasks.daily",
  cron: "0 1 * * *",  // 01:00 UTC daily

  run: async () => {
    const url = process.env["SUPABASE_URL"]
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    const db   = createClient(url, key, { auth: { persistSession: false } })
    const today = toDateString(new Date())

    // Fetch overdue recurring tasks (service role reads all users' tasks)
    const { data: tasks, error } = await db
      .from("tasks")
      .select("id, due_date, recurrence")
      .lt("due_date", today)
      .eq("is_completed", false)
      .not("recurrence", "is", null)

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`)
    if (!tasks?.length) return { advanced: 0 }

    let advanced = 0

    for (const task of tasks) {
      const recurrence = task.recurrence as Recurrence
      if (!task.due_date) continue

      // Advance past due_dates by applying the recurrence until we reach today or later
      let nextDate = nextOccurrence(task.due_date, recurrence)
      while (nextDate && toDateString(nextDate) < today) {
        nextDate = nextOccurrence(toDateString(nextDate), recurrence)
      }

      if (!nextDate) continue  // reached end of recurrence

      const { error: updErr } = await db
        .from("tasks")
        .update({ due_date: toDateString(nextDate) })
        .eq("id", task.id)

      if (!updErr) advanced++
    }

    return { advanced, total: tasks.length }
  },
})
