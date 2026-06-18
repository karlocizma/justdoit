import { getDB } from './db'
import { isNewer } from './merge'
import { enqueue, flushSoon } from './outbox'
import { toggleTaskState } from './recurrence'
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

/** Top-level tasks of a list (excludes sub-tasks), ordered like the list view. */
export async function listTopLevelTasks(listId: string): Promise<CachedTask[]> {
  const rows = await getDB().tasks.where('list_id').equals(listId).toArray()
  return rows.filter((t) => !t.parent_id).sort((a, b) => a.sort_order - b.sort_order)
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
  await reorderEntity('notes', orderedIds)
}

// ---- Task writes (optimistic) ---------------------------------------------

/** Create a task locally with a client-generated id and queue the insert. */
export async function createTask(fields: {
  list_id: string
  title: string
  sort_order?: number
  status?: string
  parent_id?: string | null
}): Promise<CachedTask> {
  const id = newId()
  const ts = nowIso()
  const row: CachedTask = {
    id,
    list_id: fields.list_id,
    parent_id: fields.parent_id ?? null,
    title: fields.title,
    notes: null,
    priority: 0,
    is_completed: false,
    completed_at: null,
    due_date: null,
    due_time: null,
    recurrence: null,
    sort_order: fields.sort_order ?? 0,
    status: fields.status ?? 'todo',
    assigned_to: null,
    created_at: ts,
    updated_at: ts,
  }
  await getDB().tasks.put(row)
  const payload: Record<string, unknown> = { id, title: row.title, list_id: row.list_id, sort_order: row.sort_order }
  if (fields.status) payload.status = fields.status
  if (fields.parent_id) payload.parent_id = fields.parent_id
  await enqueue({ entity: 'tasks', op: 'insert', entityId: id, payload })
  flushSoon()
  return row
}

/** Patch a cached task and queue the update. `updated_at` is left to the DB trigger. */
export async function updateTask(id: string, patch: Partial<CachedTask>): Promise<void> {
  const db = getDB()
  const existing = await db.tasks.get(id)
  const { updated_at: _ua, ...serverPatch } = patch
  void _ua
  if (existing) await db.tasks.put({ ...existing, ...patch, updated_at: nowIso() })
  await enqueue({ entity: 'tasks', op: 'update', entityId: id, payload: serverPatch })
  flushSoon()
}

/**
 * Toggle a task's completion, replicating the server's recurrence handling
 * (advances recurring tasks instead of marking them done). Falls back to a
 * plain toggle when the row isn't cached (e.g. an on-demand sub-task).
 */
export async function toggleTask(id: string, fallback?: { completed_at: string | null }): Promise<void> {
  const existing = await getDB().tasks.get(id)
  const source = existing ?? (fallback ? { completed_at: fallback.completed_at, due_date: null, recurrence: null } : null)
  if (!source) return
  await updateTask(id, toggleTaskState(source))
}

/** Permanently delete a task locally and queue the server delete. */
export async function deleteTaskHard(id: string): Promise<void> {
  await getDB().tasks.delete(id)
  await enqueue({ entity: 'tasks', op: 'delete', entityId: id, payload: {} })
  flushSoon()
}

/** Persist a new ordering for tasks (sort_order = position), queuing per-row updates. */
export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await reorderEntity('tasks', orderedIds)
}

// ---- List writes (optimistic) ---------------------------------------------

/** Create a list locally with a client-generated id and queue the insert. */
export async function createList(fields: { title: string; color?: string | null }): Promise<CachedList> {
  const id = newId()
  const ts = nowIso()
  const row: CachedList = {
    id,
    user_id: '',
    workspace_id: null,
    title: fields.title,
    color: fields.color ?? '#6c63ff',
    icon: null,
    is_archived: false,
    sort_order: 0,
    created_at: ts,
    updated_at: ts,
  }
  await getDB().todo_lists.put(row)
  await enqueue({ entity: 'todo_lists', op: 'insert', entityId: id, payload: { id, title: row.title, color: row.color } })
  flushSoon()
  return row
}

/** Persist a new ordering for lists (sort_order = position), queuing per-row updates. */
export async function reorderLists(orderedIds: string[]): Promise<void> {
  await reorderEntity('todo_lists', orderedIds)
}

// ---- Shared reorder helper ------------------------------------------------

async function reorderEntity(entity: 'notes' | 'tasks' | 'todo_lists', orderedIds: string[]): Promise<void> {
  const db = getDB()
  const table = db.table(entity)
  await db.transaction('rw', table, db.outbox, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const existing = await table.get(id)
      if (!existing || existing.sort_order === i) continue
      await table.put({ ...existing, sort_order: i, updated_at: nowIso() })
      await db.outbox.add({
        entity, op: 'update', entityId: id, payload: { sort_order: i },
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
