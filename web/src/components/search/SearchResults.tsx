'use client'

import Link from 'next/link'
import s from './SearchResults.module.css'

type Note = { id: string; title: string; content: string; color: string | null; updated_at: string }
type TodoList = { title: string; color: string | null } | null
type Task = { id: string; title: string; notes: string | null; priority: number; due_date: string | null; completed_at: string | null; list_id: string; todo_lists: TodoList }

export function SearchResults({ query, notes, tasks }: { query: string; notes: Note[]; tasks: Task[] }) {
  const total = notes.length + tasks.length

  if (!query) {
    return (
      <div className={s.root}>
        <h1 className={s.title}>Search</h1>
        <p className={s.hint}>Type in the search bar above to find notes and tasks.</p>
      </div>
    )
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>
        Results for <span className={s.query}>&ldquo;{query}&rdquo;</span>
      </h1>
      <p className={s.count}>{total} result{total !== 1 ? 's' : ''}</p>

      {total === 0 && (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🔍</div>
          <p>No results found. Try a different search term.</p>
        </div>
      )}

      {notes.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>Notes ({notes.length})</div>
          <div className={s.list}>
            {notes.map(n => (
              <Link key={n.id} href={`/notes/${n.id}`} className={s.item}>
                {n.color && <div className={s.noteColor} style={{ background: n.color }} />}
                <div className={s.itemBody}>
                  <div className={s.itemTitle}><Highlight text={n.title || 'Untitled'} q={query} /></div>
                  {n.content && (
                    <div className={s.itemSnippet}>
                      <Highlight text={excerptAround(n.content, query)} q={query} />
                    </div>
                  )}
                </div>
                <span className={s.relTime}>{relTime(n.updated_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tasks.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>Tasks ({tasks.length})</div>
          <div className={s.list}>
            {tasks.map(t => (
              <Link key={t.id} href={`/lists/${t.list_id}`} className={`${s.item} ${t.completed_at ? s.itemDone : ''}`}>
                <div className={`${s.taskCheck} ${t.completed_at ? s.taskChecked : ''}`}>
                  {t.completed_at && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className={s.itemBody}>
                  <div className={s.itemTitle}><Highlight text={t.title} q={query} /></div>
                  {t.todo_lists && <div className={s.taskList} style={{ color: t.todo_lists.color ?? undefined }}>{t.todo_lists.title}</div>}
                </div>
                {t.due_date && <span className={s.due}>{formatDate(t.due_date)}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className={s.mark}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function excerptAround(text: string, q: string, radius = 80) {
  const clean = text.replace(/[#*_`[\]]/g, '')
  const idx = clean.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return clean.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(clean.length, idx + q.length + radius)
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '')
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
