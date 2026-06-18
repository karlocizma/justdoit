'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createClient } from '@/lib/supabase/client'
import { pullAll } from '@/lib/offline/sync'
import { flush, retryFailed } from '@/lib/offline/outbox'
import { getDB, isOfflineCacheAvailable } from '@/lib/offline/db'

type SyncState = {
  /** Browser connectivity. */
  online: boolean
  /** A pull/flush cycle is currently running. */
  syncing: boolean
  /** ISO timestamp of the last successful cache refresh, or null. */
  lastSyncedAt: string | null
  /** Local mutations still waiting to reach the server. */
  pendingCount: number
  /** Whether any queued mutation has exhausted its retries. */
  hasFailures: boolean
  /** Trigger a manual sync (pull + flush). */
  syncNow: () => void
  /** Re-arm failed ops and flush them. */
  retryNow: () => void
}

const SyncContext = createContext<SyncState | null>(null)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const runningRef = useRef(false)

  const outbox = useLiveQuery(
    async () => {
      if (!isOfflineCacheAvailable()) return { pending: 0, failed: 0 }
      const db = getDB()
      const [pending, failed] = await Promise.all([
        db.outbox.count(),
        db.outbox.where('status').equals('failed').count(),
      ])
      return { pending, failed }
    },
    [],
    { pending: 0, failed: 0 },
  )

  const sync = useCallback(async () => {
    if (!isOfflineCacheAvailable() || runningRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    runningRef.current = true
    setSyncing(true)
    try {
      supabaseRef.current ??= createClient()
      await flush(supabaseRef.current)        // push local changes first
      await pullAll(supabaseRef.current)       // then refresh from server
      setLastSyncedAt(new Date().toISOString())
    } catch {
      // Best-effort: the UI still works from cached content.
    } finally {
      runningRef.current = false
      setSyncing(false)
    }
  }, [])

  const retryNow = useCallback(async () => {
    if (!isOfflineCacheAvailable()) return
    await retryFailed()
    void sync()
  }, [sync])

  useEffect(() => {
    const onOnline = () => { setOnline(true); void sync() }
    const onOffline = () => setOnline(false)

    setOnline(navigator.onLine)
    if (navigator.onLine) void sync()

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [sync])

  return (
    <SyncContext.Provider
      value={{
        online,
        syncing,
        lastSyncedAt,
        pendingCount: outbox.pending,
        hasFailures: outbox.failed > 0,
        syncNow: () => void sync(),
        retryNow: () => void retryNow(),
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

/** Access sync state. Returns a safe default when used outside the provider. */
export function useSync(): SyncState {
  return (
    useContext(SyncContext) ?? {
      online: true,
      syncing: false,
      lastSyncedAt: null,
      pendingCount: 0,
      hasFailures: false,
      syncNow: () => {},
      retryNow: () => {},
    }
  )
}
