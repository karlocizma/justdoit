'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import s from './NoteEditor.module.css'

type NoteUpdate = Database['public']['Tables']['notes']['Update']

type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; updated_at: string; note_tags: NoteTag[] }

const COLORS = ['#6c63ff', '#48d1cc', '#f5a623', '#e05c5c', '#4caf89', '#e91e8c', null]

export function NoteEditor({ note }: { note: Note }) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [pinned, setPinned] = useState(note.is_pinned)
  const [color, setColor] = useState<string | null>(note.color)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (patch: NoteUpdate) => {
    setSaving(true)
    await supabase.from('notes').update(patch).eq('id', note.id)
    setSaving(false)
  }, [supabase, note.id])

  function scheduleSave(patch: NoteUpdate) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(patch), 800)
  }

  async function togglePin() {
    const next = !pinned
    setPinned(next)
    await save({ is_pinned: next })
  }

  async function setNoteColor(c: string | null) {
    setColor(c)
    await save({ color: c })
  }

  async function archive() {
    await supabase.from('notes').update({ is_archived: true }).eq('id', note.id)
    router.push('/notes')
  }

  async function trash() {
    await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', note.id)
    router.push('/notes')
  }

  const tags = note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? []

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <button className={s.back} onClick={() => router.push('/notes')}>
          <ChevronLeftIcon /> Notes
        </button>
        <div className={s.toolbarRight}>
          <span className={s.saveIndicator}>{saving ? 'Saving…' : 'Saved'}</span>
          <button
            className={`${s.toolBtn} ${pinned ? s.active : ''}`}
            onClick={togglePin}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <PinIcon />
          </button>
          <div className={s.colorPicker}>
            {COLORS.map(c => (
              <button
                key={c ?? 'none'}
                className={`${s.colorSwatch} ${color === c ? s.colorActive : ''}`}
                style={{ background: c ?? 'var(--jd-surface-2)', border: c ? undefined : '1px dashed var(--jd-border)' }}
                onClick={() => setNoteColor(c)}
                title={c ?? 'No color'}
              />
            ))}
          </div>
          <button className={s.toolBtn} onClick={archive} title="Archive">
            <ArchiveIcon />
          </button>
          <button className={`${s.toolBtn} ${s.danger}`} onClick={trash} title="Trash">
            <TrashIcon />
          </button>
        </div>
      </div>

      {color && <div className={s.colorStripe} style={{ background: color }} />}

      <div className={s.editor}>
        <input
          className={s.titleInput}
          placeholder="Title"
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
        />
        <textarea
          className={s.contentArea}
          placeholder="Start writing…"
          value={content}
          onChange={e => { setContent(e.target.value); scheduleSave({ content: e.target.value }) }}
        />
        {tags.length > 0 && (
          <div className={s.tagRow}>
            {tags.map(tag => (
              <span key={tag.id} className={s.tag} style={tag.color ? { color: tag.color } : undefined}>
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronLeftIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function PinIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function ArchiveIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> }
function TrashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }
