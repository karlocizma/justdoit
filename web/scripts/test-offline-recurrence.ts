// Unit test for the recurrence/toggle port (mirrors toggle_task_complete SQL).
// Run via: tsx scripts/test-offline-recurrence.ts
import { nextOccurrence, toggleTaskState } from '../src/lib/offline/recurrence.ts'

let pass = 0
let fail = 0
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { pass++; console.log('✓', msg) }
  else { fail++; console.error(`✗ ${msg}\n    expected ${e}\n    got      ${a}`) }
}

// nextOccurrence
eq(nextOccurrence('2026-06-18', { freq: 'daily' }), '2026-06-19', 'daily +1')
eq(nextOccurrence('2026-06-18', { freq: 'daily', interval: 3 }), '2026-06-21', 'daily +3')
eq(nextOccurrence('2026-06-18', { freq: 'weekly' }), '2026-06-25', 'weekly +1')
eq(nextOccurrence('2026-06-18', { freq: 'weekly', interval: 2 }), '2026-07-02', 'weekly +2 crosses month')
eq(nextOccurrence('2026-01-31', { freq: 'monthly' }), '2026-02-28', 'monthly clamps Jan 31 → Feb 28')
eq(nextOccurrence('2026-11-30', { freq: 'monthly', interval: 2 }), '2027-01-30', 'monthly +2 crosses year')
eq(nextOccurrence('2024-02-29', { freq: 'yearly' }), '2025-02-28', 'yearly clamps leap day')
eq(nextOccurrence('2026-06-18', { freq: 'none' as never }), null, 'unknown freq → null')

// toggleTaskState — non-recurring
eq(
  toggleTaskState({ completed_at: null, due_date: null, recurrence: null }, '2026-06-18T10:00:00.000Z'),
  { is_completed: true, completed_at: '2026-06-18T10:00:00.000Z' },
  'complete: marks done',
)
eq(
  toggleTaskState({ completed_at: '2026-06-01T00:00:00.000Z', due_date: null, recurrence: null }),
  { is_completed: false, completed_at: null },
  'uncomplete: clears done',
)

// toggleTaskState — recurring advances
eq(
  toggleTaskState({ completed_at: null, due_date: '2026-06-18', recurrence: { freq: 'weekly' } }),
  { is_completed: false, completed_at: null, due_date: '2026-06-25' },
  'complete recurring: advances to next, stays open',
)
// recurring past `until` → stays completed
eq(
  toggleTaskState(
    { completed_at: null, due_date: '2026-06-18', recurrence: { freq: 'weekly', until: '2026-06-20' } },
    '2026-06-18T10:00:00.000Z',
  ),
  { is_completed: true, completed_at: '2026-06-18T10:00:00.000Z' },
  'complete recurring past until: marks done',
)
// recurring but no due date → simple complete
eq(
  toggleTaskState(
    { completed_at: null, due_date: null, recurrence: { freq: 'daily' } },
    '2026-06-18T10:00:00.000Z',
  ),
  { is_completed: true, completed_at: '2026-06-18T10:00:00.000Z' },
  'complete recurring w/o due date: marks done',
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
