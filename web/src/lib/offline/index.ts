// Offline data layer (Milestone 1 — foundation).
// See ROADMAP.md → Offline Mode.

export { getDB, isOfflineCacheAvailable, OfflineDB } from './db'
export { pullEntity, pullAll, clearCache, seedCache, applyRemoteRows, normalizeRow, type PullResult } from './sync'
export { enqueue, flush, flushSoon, pendingCount, retryFailed, type FlushResult } from './outbox'
export {
  listNotes,
  getNote,
  listLists,
  listTasksByList,
  createNote,
  updateNote,
  archiveNote,
  trashNote,
  restoreNote,
  deleteNoteHard,
  reorderNotes,
  cacheUpsert,
  cacheUpsertMany,
  cacheDelete,
  cacheDeleteMany,
} from './repository'
export { useOnlineStatus, isOnline } from './status'
export { isNewer, shouldApplyRemote, resolveIncoming, highWatermark } from './merge'
export type {
  CachedNote,
  CachedTag,
  CachedTask,
  CachedList,
  SyncEntity,
  OutboxOp,
  SyncMeta,
  Timestamped,
} from './types'
