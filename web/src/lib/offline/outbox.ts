import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getDB } from './db'
import type { OutboxOp } from './types'

/**
 * Outbox: buffers local mutations and flushes them to Supabase in FIFO order.
 *
 * Writes are applied to the cache optimistically by the repository; the outbox
 * is only responsible for replaying them against the server when online. Order
 * is strict — on the first failure we stop, so a later op never runs ahead of an
 * earlier one for the same row (e.g. update before its insert).
 */

const MAX_ATTEMPTS = 5

export type FlushResult = { done: number; failed: number }

type NewOp = Pick<OutboxOp, 'entity' | 'entityId' | 'op' | 'payload'>

/** Append a mutation to the outbox. */
export async function enqueue(op: NewOp): Promise<void> {
  await getDB().outbox.add({
    ...op,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  })
}

/** Number of ops still awaiting (or having failed) a flush. */
export function pendingCount(): Promise<number> {
  return getDB().outbox.count()
}

async function applyOp(supabase: SupabaseClient<Database>, op: OutboxOp): Promise<void> {
  // Casts: payloads include columns that lag the generated types (e.g. tasks.status).
  const table = (supabase as unknown as { from: (t: string) => any }).from(op.entity)
  if (op.op === 'insert') {
    const { error } = await table.insert(op.payload)
    if (error) throw new Error(error.message)
  } else if (op.op === 'update') {
    const { error } = await table.update(op.payload).eq('id', op.entityId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await table.delete().eq('id', op.entityId)
    if (error) throw new Error(error.message)
  }
}

let flushing = false
let client: SupabaseClient<Database> | null = null

/**
 * Drain the outbox to Supabase. Re-entrancy-guarded and a no-op while offline.
 * Stops at the first failure to preserve ordering; the op is retried on the next
 * flush until MAX_ATTEMPTS, after which it is marked `failed` and skipped.
 */
export async function flush(supabase?: SupabaseClient<Database>): Promise<FlushResult> {
  if (flushing) return { done: 0, failed: 0 }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { done: 0, failed: 0 }

  flushing = true
  const db = getDB()
  let done = 0
  let failed = 0
  try {
    if (!supabase && !client) {
      const { createClient } = await import('@/lib/supabase/client')
      client = createClient()
    }
    const sb = supabase ?? client!
    const ops = await db.outbox.orderBy('seq').toArray()
    for (const op of ops) {
      if (op.status === 'failed') continue
      try {
        await applyOp(sb, op)
        await db.outbox.delete(op.seq!)
        done++
      } catch (err) {
        const attempts = op.attempts + 1
        await db.outbox.update(op.seq!, {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: err instanceof Error ? err.message : String(err),
        })
        failed++
        break // preserve FIFO ordering — retry this op before any later one
      }
    }
  } finally {
    flushing = false
  }
  return { done, failed }
}

/** Fire-and-forget flush, safe to call after every local write. */
export function flushSoon(): void {
  void flush()
}

/** Reset failed ops back to pending so the next flush retries them. */
export async function retryFailed(): Promise<void> {
  const db = getDB()
  const failed = await db.outbox.where('status').equals('failed').toArray()
  await Promise.all(failed.map((o) => db.outbox.update(o.seq!, { status: 'pending', attempts: 0 })))
}
