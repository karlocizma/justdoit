// Offline data layer (Milestone 1 — foundation).
// See ROADMAP.md → Offline Mode.

export { getDB, isOfflineCacheAvailable, OfflineDB } from './db'
export { pullEntity, pullAll, clearCache, type PullResult } from './sync'
export {
  listNotes,
  getNote,
  listLists,
  listTasksByList,
  cacheUpsert,
  cacheUpsertMany,
  cacheDelete,
  cacheDeleteMany,
} from './repository'
export { useOnlineStatus, isOnline } from './status'
export { isNewer, shouldApplyRemote, resolveIncoming, highWatermark } from './merge'
export type {
  CachedNote,
  CachedTask,
  CachedList,
  SyncEntity,
  OutboxOp,
  SyncMeta,
  Timestamped,
} from './types'
