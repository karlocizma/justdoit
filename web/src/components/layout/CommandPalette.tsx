'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './CommandPalette.module.css'

type Result = {
  id: string
  label: string
  sub?: string
  icon: React.ReactNode
  action: () => void
}

const STATIC_COMMANDS = (router: ReturnType<typeof useRouter>): Result[] => [
  { id: 'nav-today',    label: 'Go to Today',     sub: 'Dashboard',  icon: <HomeIcon />,    action: () => router.push('/dashboard') },
  { id: 'nav-notes',    label: 'Go to Notes',     sub: 'All notes',  icon: <NoteIcon />,    action: () => router.push('/notes') },
  { id: 'nav-calendar', label: 'Go to Calendar',  sub: 'Calendar',   icon: <CalIcon />,     action: () => router.push('/calendar') },
  { id: 'nav-search',   label: 'Go to Search',    sub: 'Search',     icon: <SearchIcon />,  action: () => router.push('/search') },
  { id: 'nav-archive',  label: 'Go to Archive',   sub: 'Archive',    icon: <ArchiveIcon />, action: () => router.push('/archive') },
  { id: 'nav-settings', label: 'Open Settings',   sub: 'Settings',   icon: <SettingsIcon />,action: () => router.push('/settings') },
  { id: 'new-note',     label: 'New Note',        sub: 'Create',     icon: <PlusIcon />,    action: () => router.push('/notes/new') },
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const staticCmds = STATIC_COMMANDS(router)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults(staticCmds); return }

    const lower = trimmed.toLowerCase()
    const filtered = staticCmds.filter(c =>
      c.label.toLowerCase().includes(lower) || c.sub?.toLowerCase().includes(lower)
    )

    const { data: notes } = await supabase
      .from('notes')
      .select('id, title')
      .ilike('title', `%${trimmed}%`)
      .is('deleted_at', null)
      .eq('is_archived', false)
      .limit(5)

    const noteResults: Result[] = (notes ?? []).map(n => ({
      id: `note-${n.id}`,
      label: n.title || 'Untitled',
      sub: 'Note',
      icon: <NoteIcon />,
      action: () => router.push(`/notes/${n.id}`),
    }))

    const { data: lists } = await supabase
      .from('todo_lists')
      .select('id, title')
      .ilike('title', `%${trimmed}%`)
      .eq('is_archived', false)
      .limit(5)

    const listResults: Result[] = (lists ?? []).map(l => ({
      id: `list-${l.id}`,
      label: l.title,
      sub: 'List',
      icon: <ListIcon />,
      action: () => router.push(`/lists/${l.id}`),
    }))

    setResults([...filtered, ...noteResults, ...listResults])
  }, [router, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(staticCmds)
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    setIndex(0)
  }, [results])

  function execute(r: Result) {
    r.action()
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[index]) execute(results[index]) }
    else if (e.key === 'Escape') { onClose() }
  }

  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  return (
    <div className={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={s.palette}>
        <div className={s.inputRow}>
          <span className={s.inputIcon}><SearchIcon /></span>
          <input
            ref={inputRef}
            className={s.input}
            placeholder="Search notes, lists, or type a command…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={s.esc}>Esc</kbd>
        </div>
        <div className={s.list} ref={listRef}>
          {results.length === 0 && (
            <div className={s.empty}>No results for &ldquo;{query}&rdquo;</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`${s.item} ${i === index ? s.itemActive : ''}`}
              onMouseDown={() => execute(r)}
              onMouseEnter={() => setIndex(i)}
            >
              <span className={s.itemIcon}>{r.icon}</span>
              <span className={s.itemLabel}>{r.label}</span>
              {r.sub && <span className={s.itemSub}>{r.sub}</span>}
            </button>
          ))}
        </div>
        <div className={s.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

function HomeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function NoteIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
function CalIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function ArchiveIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> }
function SettingsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function ListIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }
