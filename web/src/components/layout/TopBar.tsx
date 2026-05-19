'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import s from './TopBar.module.css'

type User = { email: string; name?: string }

export function TopBar({ user }: { user: User }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const initial = (user.name ?? user.email).slice(0, 2).toUpperCase()

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
    <header className={s.root}>
      <div className={s.searchWrap}>
        <div className={s.searchIcon}><SearchIcon /></div>
        <input
          className={s.searchInput}
          placeholder="Search notes and tasks…"
          value={query}
          onFocus={handleFocus}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>
      <div className={s.right}>
        <div className={s.sync}>
          <span className={`${s.syncDot} ${s.connected}`} />
          <span className={s.syncLabel}>Connected</span>
        </div>
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
