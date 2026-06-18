import { getDB } from './db'
import { isNewer } from './merge'
import type { CachedNote, CachedTask, CachedList, SyncEntity } from './types'

/**
 * Read API over the local cache, plus cache-maintenance helpers used after a
 * successful Supabase write to keep IndexedDB consistent.
 *
 * Milestone 1 keeps mutations online-direct (callers write to Supabase, then
 * call `cacheUpsert` here). The optimistic outbox path lands in the
 * offline-writes milestone.
 */

// ---- Notes ----------------------------------------------------------------

/** Active notes (not archived, not trashed), ordered like the Notes grid. */
export async function listNotes(): Promise<CachedNote[]> {
  const rows = await getDB().notes
    .filter((n) => !n.is_archived && !n.deleted_at)
    .toArray()
  return rows.sort(
    (a, b) =>
      Number(b.is_pinned) - Number(a.is_pinned) ||
      a.sort_order - b.sort_order ||
      (isNewer(a.updated_at, b.updated_at) ? -1 : 1),
  )
}

export function getNote(id: string): Promise<CachedNote | undefined> {
  return getDB().notes.get(id)
}

// ---- Lists ----------------------------------------------------------------

export async function listLists(): Promise<CachedList[]> {
  const rows = await getDB().todo_lists.filter((l) => !l.is_archived).toArray()
  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

// ---- Tasks ----------------------------------------------------------------

export async function listTasksByList(listId: string): Promise<CachedTask[]> {
  const rows = await getDB().tasks.where('list_id').equals(listId).toArray()
  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

// ---- Cache maintenance ----------------------------------------------------

const tableFor = (entity: SyncEntity) => getDB().table(entity)

/** Upsert a freshly written row into the cache. */
export async function cacheUpsert<T extends { id: string }>(entity: SyncEntity, row: T): Promise<void> {
  await tableFor(entity).put(row)
}

/** Upsert many rows (e.g. after a reorder). */
export async function cacheUpsertMany<T extends { id: string }>(entity: SyncEntity, rows: T[]): Promise<void> {
  if (rows.length) await tableFor(entity).bulkPut(rows)
}

/** Remove a row from the cache after a hard delete. */
export async function cacheDelete(entity: SyncEntity, id: string): Promise<void> {
  await tableFor(entity).delete(id)
}

export async function cacheDeleteMany(entity: SyncEntity, ids: string[]): Promise<void> {
  if (ids.length) await tableFor(entity).bulkDelete(ids)
}
