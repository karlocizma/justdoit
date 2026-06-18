'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useTheme } from '@/components/layout/ThemeProvider'
import { TourButton } from '@/components/onboarding/TourModal'
import { useSync } from '@/components/offline/SyncProvider'
import { SyncStatusMenu } from '@/components/offline/SyncStatusMenu'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import s from './TopBar.module.css'

type User = { email: string; name?: string }

export function TopBar({ user, userId }: { user: User; userId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { online, syncing, pendingCount, hasFailures } = useSync()
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const initial = (user.name ?? user.email).slice(0, 2).toUpperCase()

  const syncLabel = !online
    ? (pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline')
    : hasFailures
      ? 'Sync error'
      : syncing
        ? 'Syncing…'
        : pendingCount > 0
          ? `${pendingCount} pending`
          : 'Connected'
  const [modKey, setModKey] = useState('Ctrl')

  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) setModKey('⌘')
  }, [])

  function handleSearch(value: string) {
    setQuery(value)
    if (value.trim()) {
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(value.trim())}`)
      })
    }
  }

  function handleFocus() {
    if (!query) {
      router.push('/search')
    }
  }

  return (
    <header className={s.root} data-role="topbar" suppressHydrationWarning>
      <div className={s.searchWrap}>
        <div className={s.searchIcon}><SearchIcon /></div>
        <input
          className={s.searchInput}
          placeholder={`Search… (${modKey}K for commands)`}
          value={query}
          onFocus={handleFocus}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>
      <div className={s.right}>
        <div className={s.syncWrap}>
          <button
            type="button"
            className={s.sync}
            onClick={() => setSyncMenuOpen(o => !o)}
            aria-haspopup="dialog"
            aria-expanded={syncMenuOpen}
            title={online
              ? (pendingCount > 0 ? `${pendingCount} change(s) waiting to sync` : 'Connected to the server')
              : 'Offline — your changes are saved on this device and will sync when you reconnect'}
          >
            <span className={`${s.syncDot} ${online && !hasFailures ? s.connected : s.disconnected}`} />
            <span className={s.syncLabel} suppressHydrationWarning>{syncLabel}</span>
          </button>
          {syncMenuOpen && <SyncStatusMenu onClose={() => setSyncMenuOpen(false)} />}
        </div>
        <NotificationsBell userId={userId} />
        <TourButton />
        <button
          className={s.themeBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          className={s.avatar}
          title={user.email}
          onClick={() => router.push('/settings')}
        >
          {initial}
        </button>
      </div>
    </header>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  )
}
