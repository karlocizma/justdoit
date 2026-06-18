// Unit test for the pure last-write-wins merge logic (no IndexedDB needed).
// Run: node scripts/test-offline-merge.ts   (Node >= 23 strips the TS types)
import { isNewer, shouldApplyRemote, resolveIncoming, highWatermark } from '../src/lib/offline/merge.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('✓', msg) }
  else { fail++; console.error('✗', msg) }
}

const t1 = '2026-06-18T10:00:00.000Z'
const t2 = '2026-06-18T11:00:00.000Z'

// isNewer
ok(isNewer(t2, t1) === true, 'isNewer: later > earlier')
ok(isNewer(t1, t2) === false, 'isNewer: earlier !> later')
ok(isNewer(t1, t1) === false, 'isNewer: equal is not newer')
ok(isNewer(t1, null) === true, 'isNewer: anything > null')
ok(isNewer(null, t1) === false, 'isNewer: null is never newer')

// shouldApplyRemote
ok(shouldApplyRemote(undefined, { id: 'a', updated_at: t1 }, false) === true, 'apply: no local copy')
ok(shouldApplyRemote({ id: 'a', updated_at: t1 }, { id: 'a', updated_at: t2 }, false) === true, 'apply: remote newer')
ok(shouldApplyRemote({ id: 'a', updated_at: t2 }, { id: 'a', updated_at: t1 }, false) === false, 'skip: local newer')
ok(shouldApplyRemote(undefined, { id: 'a', updated_at: t2 }, true) === false, 'skip: pending local change wins')

// resolveIncoming
const local = new Map([
  ['keep-local', { id: 'keep-local', updated_at: t2 }],
  ['take-remote', { id: 'take-remote', updated_at: t1 }],
  ['pending', { id: 'pending', updated_at: t1 }],
])
const incoming = [
  { id: 'keep-local', updated_at: t1 },   // older -> skip
  { id: 'take-remote', updated_at: t2 },  // newer -> apply
  { id: 'pending', updated_at: t2 },      // newer but pending -> skip
  { id: 'brand-new', updated_at: t1 },    // no local -> apply
]
const applied = resolveIncoming(local, incoming, new Set(['pending'])).map((r) => r.id).sort()
ok(JSON.stringify(applied) === JSON.stringify(['brand-new', 'take-remote']), 'resolveIncoming picks correct subset')

// highWatermark
ok(highWatermark(null, [{ updated_at: t1 }, { updated_at: t2 }]) === t2, 'highWatermark: newest of batch')
ok(highWatermark(t2, [{ updated_at: t1 }]) === t2, 'highWatermark: keeps existing when batch older')
ok(highWatermark(null, []) === null, 'highWatermark: empty batch keeps current')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
