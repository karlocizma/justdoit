import type { Timestamped } from './types'

/**
 * Pure last-write-wins helpers. Kept free of Dexie/Supabase imports so the
 * conflict logic can be unit-tested without IndexedDB.
 */

/** Compare two ISO timestamps; returns true if `a` is strictly newer than `b`. */
export function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false
  if (!b) return true
  return Date.parse(a) > Date.parse(b)
}

/**
 * Decide whether a row pulled from the server should overwrite the local copy.
 *
 * Last-write-wins on `updated_at`, with one guard: never clobber a row that has
 * a pending local mutation in the outbox — the local edit must flush first
 * (handled in the write-sync milestone).
 */
export function shouldApplyRemote(
  local: Timestamped | undefined,
  remote: Timestamped,
  hasPendingLocalChange: boolean,
): boolean {
  if (hasPendingLocalChange) return false
  if (!local) return true
  return isNewer(remote.updated_at, local.updated_at)
}

/**
 * Given the current local rows and a batch of remote rows, return the subset of
 * remote rows that should be written locally (LWW), skipping any ids that have a
 * pending local change.
 */
export function resolveIncoming<T extends Timestamped>(
  localById: Map<string, T>,
  remote: T[],
  pendingIds: ReadonlySet<string>,
): T[] {
  return remote.filter((row) =>
    shouldApplyRemote(localById.get(row.id), row, pendingIds.has(row.id)),
  )
}

/** The newest `updated_at` across a batch, or the existing watermark if newer. */
export function highWatermark(
  current: string | null,
  rows: ReadonlyArray<{ updated_at: string }>,
): string | null {
  return rows.reduce<string | null>(
    (max, r) => (isNewer(r.updated_at, max) ? r.updated_at : max),
    current,
  )
}
