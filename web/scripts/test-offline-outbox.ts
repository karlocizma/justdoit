// Integration test for the outbox flush worker against an in-memory IndexedDB.
// Run: node scripts/test-offline-outbox.ts   (Node >= 23 strips the TS types)
import 'fake-indexeddb/auto'
import { enqueue, flush, pendingCount, retryFailed } from '../src/lib/offline/outbox.ts'
import { getDB } from '../src/lib/offline/db.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('✓', msg) }
  else { fail++; console.error('✗', msg) }
}

// A recording fake Supabase client whose behavior is controlled per-op.
type Behavior = (op: string, table: string, id?: string) => { error: { message: string } | null }
function makeClient(behavior: Behavior) {
  const calls: { op: string; table: string; id?: string }[] = []
  const api = (table: string) => ({
    insert(payload: { id?: string }) {
      calls.push({ op: 'insert', table, id: payload?.id })
      return Promise.resolve(behavior('insert', table, payload?.id))
    },
    update() {
      return {
        eq(_col: string, id: string) {
          calls.push({ op: 'update', table, id })
          return Promise.resolve(behavior('update', table, id))
        },
      }
    },
    delete() {
      return {
        eq(_col: string, id: string) {
          calls.push({ op: 'delete', table, id })
          return Promise.resolve(behavior('delete', table, id))
        },
      }
    },
  })
  return { client: { from: api } as any, calls }
}

const ALWAYS_OK: Behavior = () => ({ error: null })

async function reset() {
  await getDB().outbox.clear()
}

async function run() {
  // 1. FIFO ordering + clears the outbox on success
  await reset()
  await enqueue({ entity: 'notes', op: 'insert', entityId: 'A', payload: { id: 'A' } })
  await enqueue({ entity: 'notes', op: 'update', entityId: 'A', payload: { title: 'x' } })
  await enqueue({ entity: 'notes', op: 'insert', entityId: 'B', payload: { id: 'B' } })
  const c1 = makeClient(ALWAYS_OK)
  const r1 = await flush(c1.client)
  ok(r1.done === 3 && r1.failed === 0, 'flush: all three ops succeed')
  ok(
    JSON.stringify(c1.calls.map((c) => `${c.op}:${c.id}`)) ===
      JSON.stringify(['insert:A', 'update:A', 'insert:B']),
    'flush: ops applied in FIFO order',
  )
  ok((await pendingCount()) === 0, 'flush: outbox emptied after success')

  // 2. Stops at the first failure, preserving order for later ops
  await reset()
  await enqueue({ entity: 'notes', op: 'insert', entityId: 'A', payload: { id: 'A' } })
  await enqueue({ entity: 'notes', op: 'update', entityId: 'A', payload: { title: 'x' } })
  await enqueue({ entity: 'notes', op: 'update', entityId: 'A', payload: { title: 'y' } })
  const failOnUpdate: Behavior = (op) => (op === 'update' ? { error: { message: 'boom' } } : { error: null })
  const c2 = makeClient(failOnUpdate)
  const r2 = await flush(c2.client)
  ok(r2.done === 1 && r2.failed === 1, 'flush: stops after first failing op')
  ok(c2.calls.length === 2, 'flush: did not run ops after the failure')
  ok((await pendingCount()) === 2, 'flush: failed op + later op remain queued')
  const ops2 = await getDB().outbox.orderBy('seq').toArray()
  ok(ops2[0].attempts === 1 && ops2[0].status === 'pending', 'flush: failed op retried (attempts=1)')

  // 3. Op marked failed after MAX_ATTEMPTS, then skipped
  await reset()
  await enqueue({ entity: 'notes', op: 'update', entityId: 'Z', payload: { title: 'z' } })
  const cFail = makeClient(() => ({ error: { message: 'nope' } }))
  for (let i = 0; i < 5; i++) await flush(cFail.client)
  const opsZ = await getDB().outbox.orderBy('seq').toArray()
  ok(opsZ.length === 1 && opsZ[0].status === 'failed' && opsZ[0].attempts === 5, 'flush: gives up after 5 attempts')
  const skip = await flush(makeClient(ALWAYS_OK).client)
  ok(skip.done === 0, 'flush: failed ops are skipped on subsequent flushes')

  // 4. retryFailed re-arms failed ops
  await retryFailed()
  const after = await getDB().outbox.orderBy('seq').toArray()
  ok(after[0].status === 'pending' && after[0].attempts === 0, 'retryFailed: resets status/attempts')
  const r4 = await flush(makeClient(ALWAYS_OK).client)
  ok(r4.done === 1 && (await pendingCount()) === 0, 'retryFailed: op flushes after re-arm')

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

run()
