import type { Database } from '@/lib/database.types'

type Tables = Database['public']['Tables']

/** A tag as denormalized onto a cached note for display (editing stays online-only). */
export type CachedTag = { id: string; name: string; color: string | null }

/**
 * Rows cached locally for offline use. We omit Postgres-generated columns that
 * we never select (e.g. the `content_tsv` tsvector) and add columns that lag the
 * generated types (`tasks.status` / `tasks.assigned_to`, see CLAUDE.md).
 */
export type CachedNote = Omit<Tables['notes']['Row'], 'content_tsv'> & {
  /** Denormalized from note_tags(tags(...)) during pull, for offline display. */
  tags?: CachedTag[]
}
export type CachedTask = Tables['tasks']['Row'] & {
  status?: string | null
  assigned_to?: string | null
}
export type CachedList = Tables['todo_lists']['Row']

/** Entities that participate in offline sync. */
export type SyncEntity = 'notes' | 'tasks' | 'todo_lists'

/** A pending local mutation awaiting flush to Supabase (used from Milestone 3). */
export type OutboxOp = {
  seq?: number
  entity: SyncEntity
  entityId: string
  op: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  status: 'pending' | 'syncing' | 'failed'
  attempts: number
  error?: string
  createdAt: string
}

/** Per-entity sync bookkeeping. */
export type SyncMeta = {
  entity: SyncEntity
  /** ISO timestamp of the newest `updated_at` we have pulled for this entity. */
  lastPulledAt: string | null
}

/** Anything with an `updated_at` timestamp — the basis for last-write-wins. */
export type Timestamped = { id: string; updated_at: string }
