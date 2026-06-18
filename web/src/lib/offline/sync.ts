import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getDB, type OfflineDB } from './db'
import { resolveIncoming, highWatermark } from './merge'
import type { SyncEntity, SyncMeta, Timestamped } from './types'

/**
 * Pull engine: refreshes the local cache from Supabase using incremental
 * `updated_at` watermarks and last-write-wins conflict resolution. The same
 * merge path is reused to seed the cache from server-rendered props.
 */

// Explicit column lists so we never pull generated columns (e.g. notes.content_tsv).
// `tasks.status` / `tasks.assigned_to` lag the generated types but exist in the DB.
// Notes embed their tags so they can render offline (tag *editing* stays online-only).
const COLUMNS: Record<SyncEntity, string> = {
  notes:
    'id, user_id, workspace_id, title, content, color, is_pinned, is_archived, sort_order, due_at, deleted_at, created_at, updated_at, note_tags(tags(id, name, color))',
  tasks:
    'id, list_id, parent_id, title, notes, priority, is_completed, completed_at, due_date, due_time, recurrence, sort_order, status, assigned_to, created_at, updated_at',
  todo_lists:
    'id, user_id, workspace_id, title, color, icon, is_archived, sort_order, created_at, updated_at',
}

const ENTITIES: SyncEntity[] = ['notes', 'tasks', 'todo_lists']

export type PullResult = { entity: SyncEntity; pulled: number; applied: number }

/** Flatten the PostgREST `note_tags(tags(...))` embed into a plain `tags[]`. */
export function normalizeRow(entity: SyncEntity, row: Record<string, unknown>): Record<string, unknown> {
  if (entity !== 'notes') return row
  const noteTags = (row.note_tags as { tags: unknown }[] | undefined) ?? []
  const { note_tags, ...rest } = row
  void note_tags
  return { ...rest, tags: noteTags.map((nt) => nt.tags).filter(Boolean) }
}

async function pendingIdsFor(db: OfflineDB, entity: SyncEntity): Promise<Set<string>> {
  const ops = await db.outbox.where('entity').equals(entity).toArray()
  return new Set(ops.filter((o) => o.status !== 'failed').map((o) => o.entityId))
}

/**
 * Merge a batch of rows into the local cache with last-write-wins, skipping any
 * ids that have a pending local change. Shared by pull and seed.
 */
export async function applyRemoteRows(entity: SyncEntity, rows: Timestamped[]): Promise<number> {
  if (rows.length === 0) return 0
  const db = getDB()
  const table = db.table(entity)
  const existing = (await table.bulkGet(rows.map((r) => r.id))) as (Timestamped | undefined)[]
  const localById = new Map<string, Timestamped>()
  existing.forEach((row) => { if (row) localById.set(row.id, row) })

  const pending = await pendingIdsFor(db, entity)
  const toApply = resolveIncoming(localById, rows, pending)
  if (toApply.length) await table.bulkPut(toApply)
  return toApply.length
}

/** Seed the cache from server-rendered rows (already shaped) without advancing the pull watermark. */
export async function seedCache(entity: SyncEntity, rows: Record<string, unknown>[]): Promise<number> {
  return applyRemoteRows(entity, rows.map((r) => normalizeRow(entity, r)) as Timestamped[])
}

/** Pull a single entity's changed rows into the local cache. */
export async function pullEntity(
  supabase: SupabaseClient<Database>,
  entity: SyncEntity,
): Promise<PullResult> {
  const db = getDB()
  const meta = (await db.sync_meta.get(entity)) ?? { entity, lastPulledAt: null }

  let query = supabase.from(entity).select(COLUMNS[entity]).order('updated_at', { ascending: true })
  if (meta.lastPulledAt) query = query.gt('updated_at', meta.lastPulledAt)

  const { data, error } = await query
  if (error) throw error

  const remote = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => normalizeRow(entity, r)) as unknown as Timestamped[]
  if (remote.length === 0) return { entity, pulled: 0, applied: 0 }

  let applied = 0
  await db.transaction('rw', db.table(entity), db.outbox, db.sync_meta, async () => {
    applied = await applyRemoteRows(entity, remote)
    const next: SyncMeta = { entity, lastPulledAt: highWatermark(meta.lastPulledAt, remote) }
    await db.sync_meta.put(next)
  })

  return { entity, pulled: remote.length, applied }
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
