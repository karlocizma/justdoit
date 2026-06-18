'use client'

import { useEffect, useRef } from 'react'
import { useSync } from './SyncProvider'
import s from './SyncStatusMenu.module.css'

/** Popover summarizing sync state with manual sync / retry actions. */
export function SyncStatusMenu({ onClose }: { onClose: () => void }) {
  const { online, syncing, pendingCount, hasFailures, lastSyncedAt, syncNow, retryNow } = useSync()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const status = !online ? 'Offline' : hasFailures ? 'Sync error' : syncing ? 'Syncing…' : 'Connected'
  const dotClass = !online || hasFailures ? s.dotWarn : s.dotOk

  return (
    <div className={s.menu} ref={ref} role="dialog" aria-label="Sync status">
      <div className={s.header}>
        <span className={`${s.dot} ${dotClass}`} />
        <span className={s.status}>{status}</span>
      </div>

      <div className={s.row}>
        <span className={s.label}>Last synced</span>
        <span className={s.value}>{lastSyncedAt ? formatRelative(lastSyncedAt) : '—'}</span>
      </div>
      <div className={s.row}>
        <span className={s.label}>Pending changes</span>
        <span className={s.value}>{pendingCount}</span>
      </div>

      {!online && (
        <p className={s.note}>Your changes are saved on this device and will sync when you reconnect.</p>
      )}
      {hasFailures && (
        <p className={`${s.note} ${s.noteWarn}`}>Some changes couldn&rsquo;t be synced. Retry, or they&rsquo;ll stay queued.</p>
      )}

      <div className={s.actions}>
        {hasFailures && (
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => { retryNow(); onClose() }}>
            Retry failed
          </button>
        )}
        <button
          className={s.btn}
          onClick={() => { syncNow(); onClose() }}
          disabled={!online || syncing}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
    </div>
  )
}

function formatRelative(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}
