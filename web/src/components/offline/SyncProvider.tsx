'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { pullAll } from '@/lib/offline/sync'
import { isOfflineCacheAvailable } from '@/lib/offline/db'

type SyncState = {
  /** Browser connectivity. */
  online: boolean
  /** A pull is currently running. */
  syncing: boolean
  /** ISO timestamp of the last successful cache refresh, or null. */
  lastSyncedAt: string | null
  /** Trigger a manual cache refresh. */
  syncNow: () => void
}

const SyncContext = createContext<SyncState | null>(null)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const runningRef = useRef(false)

  const sync = useCallback(async () => {
    if (!isOfflineCacheAvailable() || runningRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    runningRef.current = true
    setSyncing(true)
    try {
      supabaseRef.current ??= createClient()
      await pullAll(supabaseRef.current)
      setLastSyncedAt(new Date().toISOString())
    } catch {
      // Best-effort: the UI still works from server-rendered/cached content.
    } finally {
      runningRef.current = false
      setSyncing(false)
    }
  }, [])

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
    <SyncContext.Provider value={{ online, syncing, lastSyncedAt, syncNow: () => void sync() }}>
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
      syncNow: () => {},
    }
  )
}
