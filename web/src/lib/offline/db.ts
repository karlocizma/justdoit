import Dexie, { type Table } from 'dexie'
import type { CachedNote, CachedTask, CachedList, OutboxOp, SyncMeta } from './types'

/**
 * Local-first cache for offline mode. Holds the user's notes, tasks and lists
 * plus an outbox of pending mutations and per-entity sync bookkeeping.
 *
 * Scope (v1): notes, tasks, todo_lists only. Search, workspaces, attachments,
 * AI and export stay online-only.
 */
export class OfflineDB extends Dexie {
  notes!: Table<CachedNote, string>
  tasks!: Table<CachedTask, string>
  todo_lists!: Table<CachedList, string>
  outbox!: Table<OutboxOp, number>
  sync_meta!: Table<SyncMeta, string>

  constructor() {
    super('justdoit-offline')
    this.version(1).stores({
      notes: 'id, updated_at, is_archived, deleted_at, is_pinned, sort_order, workspace_id',
      tasks: 'id, list_id, updated_at, is_completed, parent_id, sort_order',
      todo_lists: 'id, updated_at, is_archived, sort_order, workspace_id',
      outbox: '++seq, entity, entityId, status, createdAt',
      sync_meta: 'entity',
    })
  }
}

let _db: OfflineDB | null = null

/**
 * Lazily construct the Dexie instance. Guarded so importing this module never
 * touches IndexedDB at module-eval time (safe for SSR / server components).
 */
export function getDB(): OfflineDB {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment')
  }
  if (!_db) _db = new OfflineDB()
  return _db
}

/** True when a local cache is usable (browser with IndexedDB). */
export function isOfflineCacheAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
