import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getDB, type OfflineDB } from './db'
import { resolveIncoming, highWatermark } from './merge'
import type { SyncEntity, SyncMeta, Timestamped } from './types'

/**
 * Pull engine: refreshes the local cache from Supabase using incremental
 * `updated_at` watermarks and last-write-wins conflict resolution.
 *
 * Writes (the outbox flush) are added in the offline-writes milestone; for now
 * the outbox is only consulted so we never clobber a pending local change.
 */

// Explicit column lists so we never pull generated columns (e.g. notes.content_tsv).
// `tasks.status` / `tasks.assigned_to` lag the generated types but exist in the DB.
const COLUMNS: Record<SyncEntity, string> = {
  notes:
    'id, user_id, workspace_id, title, content, color, is_pinned, is_archived, sort_order, due_at, deleted_at, created_at, updated_at',
  tasks:
    'id, list_id, parent_id, title, notes, priority, is_completed, completed_at, due_date, due_time, recurrence, sort_order, status, assigned_to, created_at, updated_at',
  todo_lists:
    'id, user_id, workspace_id, title, color, icon, is_archived, sort_order, created_at, updated_at',
}

const ENTITIES: SyncEntity[] = ['notes', 'tasks', 'todo_lists']

export type PullResult = { entity: SyncEntity; pulled: number; applied: number }

async function getMeta(db: OfflineDB, entity: SyncEntity): Promise<SyncMeta> {
  return (await db.sync_meta.get(entity)) ?? { entity, lastPulledAt: null }
}

async function pendingIdsFor(db: OfflineDB, entity: SyncEntity): Promise<Set<string>> {
  const ops = await db.outbox.where('entity').equals(entity).toArray()
  return new Set(ops.filter((o) => o.status !== 'failed').map((o) => o.entityId))
}

/** Pull a single entity's changed rows into the local cache. */
export async function pullEntity(
  supabase: SupabaseClient<Database>,
  entity: SyncEntity,
): Promise<PullResult> {
  const db = getDB()
  const meta = await getMeta(db, entity)

  let query = supabase.from(entity).select(COLUMNS[entity]).order('updated_at', { ascending: true })
  if (meta.lastPulledAt) query = query.gt('updated_at', meta.lastPulledAt)

  const { data, error } = await query
  if (error) throw error

  const remote = (data ?? []) as unknown as Timestamped[]
  if (remote.length === 0) return { entity, pulled: 0, applied: 0 }

  const table = db.table(entity)
  const ids = remote.map((r) => r.id)
  const existing = (await table.bulkGet(ids)) as (Timestamped | undefined)[]
  const localById = new Map<string, Timestamped>()
  existing.forEach((row) => { if (row) localById.set(row.id, row) })

  const pending = await pendingIdsFor(db, entity)
  const toApply = resolveIncoming(localById, remote, pending)

  await db.transaction('rw', table, db.sync_meta, async () => {
    if (toApply.length) await table.bulkPut(toApply)
    await db.sync_meta.put({ entity, lastPulledAt: highWatermark(meta.lastPulledAt, remote) })
  })

  return { entity, pulled: remote.length, applied: toApply.length }
}

/** Pull all offline entities. Errors per-entity are surfaced to the caller. */
export async function pullAll(supabase: SupabaseClient<Database>): Promise<PullResult[]> {
  const results: PullResult[] = []
  for (const entity of ENTITIES) {
    results.push(await pullEntity(supabase, entity))
  }
  return results
}

/** Drop the entire local cache (e.g. on sign-out). */
export async function clearCache(): Promise<void> {
  const db = getDB()
  await db.transaction('rw', db.notes, db.tasks, db.todo_lists, db.outbox, db.sync_meta, async () => {
    await Promise.all([
      db.notes.clear(),
      db.tasks.clear(),
      db.todo_lists.clear(),
      db.outbox.clear(),
      db.sync_meta.clear(),
    ])
  })
}
