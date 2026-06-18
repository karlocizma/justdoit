import { getDB } from './db'
import { isNewer } from './merge'
import { enqueue, flushSoon } from './outbox'
import type { CachedNote, CachedTask, CachedList, SyncEntity } from './types'

/**
 * Local-first data API. Reads come from the cache; writes are optimistic — they
 * update IndexedDB immediately and enqueue an outbox op that flushes to Supabase
 * when online. Callers no longer talk to supabase-js directly for these paths.
 */

const nowIso = () => new Date().toISOString()
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

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

// ---- Note writes (optimistic) ---------------------------------------------

/** Create a note locally with a client-generated id and queue the insert. */
export async function createNote(fields: { title?: string; content?: string } = {}): Promise<CachedNote> {
  const id = newId()
  const ts = nowIso()
  const row: CachedNote = {
    id,
    user_id: '',
    workspace_id: null,
    title: fields.title ?? 'Untitled',
    content: fields.content ?? '',
    color: null,
    is_pinned: false,
    is_archived: false,
    sort_order: 0,
    due_at: null,
    deleted_at: null,
    created_at: ts,
    updated_at: ts,
    tags: [],
  }
  await getDB().notes.put(row)
  await enqueue({ entity: 'notes', op: 'insert', entityId: id, payload: { id, title: row.title, content: row.content } })
  flushSoon()
  return row
}

/** Patch a cached note and queue the update. `tags`/`updated_at` are never sent. */
export async function updateNote(id: string, patch: Partial<CachedNote>): Promise<void> {
  const db = getDB()
  const existing = await db.notes.get(id)
  const { tags: _tags, updated_at: _ua, ...serverPatch } = patch
  void _tags; void _ua
  // Update the cache when the row is present; always queue so edits to rows that
  // haven't been pulled yet (e.g. Trash restore) still reach the server.
  if (existing) await db.notes.put({ ...existing, ...patch, updated_at: nowIso() })
  await enqueue({ entity: 'notes', op: 'update', entityId: id, payload: serverPatch })
  flushSoon()
}

export const archiveNote = (id: string) => updateNote(id, { is_archived: true })
export const trashNote = (id: string) => updateNote(id, { deleted_at: nowIso() })
export const restoreNote = (id: string) => updateNote(id, { deleted_at: null })

/** Permanently delete a note locally and queue the server delete. */
export async function deleteNoteHard(id: string): Promise<void> {
  await getDB().notes.delete(id)
  await enqueue({ entity: 'notes', op: 'delete', entityId: id, payload: {} })
  flushSoon()
}

/** Persist a new ordering for notes (sort_order = position), queuing per-row updates. */
export async function reorderNotes(orderedIds: string[]): Promise<void> {
  const db = getDB()
  await db.transaction('rw', db.notes, db.outbox, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const existing = await db.notes.get(id)
      if (!existing || existing.sort_order === i) continue
      await db.notes.put({ ...existing, sort_order: i, updated_at: nowIso() })
      await db.outbox.add({
        entity: 'notes', op: 'update', entityId: id, payload: { sort_order: i },
        status: 'pending', attempts: 0, createdAt: nowIso(),
      })
    }
  })
  flushSoon()
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
