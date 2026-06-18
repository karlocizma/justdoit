/**
 * Client-side port of the server's `toggle_task_complete` recurrence logic
 * (supabase/migrations/.../recurring_tasks.sql), so completing a task offline
 * produces the same end state the RPC would. Pure — no Dexie/Supabase imports.
 *
 * NOTE: keep in sync with the SQL function. Month/year math clamps to the last
 * day of the month to match PostgreSQL `date + interval` semantics
 * (e.g. Jan 31 + 1 month → Feb 28).
 */

export type Recurrence = {
  freq?: 'daily' | 'weekly' | 'monthly' | 'yearly' | string
  interval?: number
  until?: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const total = (m - 1) + months
  const year = y + Math.floor(total / 12)
  const month0 = ((total % 12) + 12) % 12
  const day = Math.min(d, daysInMonth(year, month0))
  return fmt(year, month0, day)
}

/** The next occurrence date (YYYY-MM-DD) for a recurrence, or null if not applicable. */
export function nextOccurrence(dueDate: string, recurrence: Recurrence): string | null {
  const n = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1
  switch (recurrence.freq) {
    case 'daily': return addDays(dueDate, n)
    case 'weekly': return addDays(dueDate, n * 7)
    case 'monthly': return addMonths(dueDate, n)
    case 'yearly': return addMonths(dueDate, n * 12)
    default: return null
  }
}

export type ToggleInput = {
  completed_at: string | null
  due_date: string | null
  recurrence: unknown
}

export type TogglePatch = {
  is_completed: boolean
  completed_at: string | null
  due_date?: string | null
}

/**
 * Compute the post-toggle state for a task, mirroring `toggle_task_complete`:
 * - uncompleting → clears completion
 * - completing a recurring task with a due date → advances to the next
 *   occurrence (unless past `until`), staying incomplete
 * - completing anything else → marks complete
 */
export function toggleTaskState(task: ToggleInput, now: string = new Date().toISOString()): TogglePatch {
  const wasComplete = !!task.completed_at
  if (wasComplete) {
    return { is_completed: false, completed_at: null }
  }

  const recurrence = (task.recurrence ?? null) as Recurrence | null
  if (recurrence && task.due_date) {
    const next = nextOccurrence(task.due_date, recurrence)
    const until = recurrence.until ?? null
    if (next && (!until || next <= until)) {
      return { is_completed: false, completed_at: null, due_date: next }
    }
  }

  return { is_completed: true, completed_at: now }
}
