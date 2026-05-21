'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import s from './NotesList.module.css'

type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; sort_order?: number; updated_at: string; note_tags: NoteTag[] }

export function NotesList({ notes: initial, tags = [] }: { notes: Note[]; tags?: Tag[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [notes, setNotes] = useState(initial)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function createNote() {
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'Untitled', content: '' })
      .select('id')
      .single()
    if (data) router.push(`/notes/${data.id}`)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const restNotes = notes.filter(n => !n.is_pinned)
    const pinnedNotes = notes.filter(n => n.is_pinned)

    const oldIndex = restNotes.findIndex(n => n.id === active.id)
    const newIndex = restNotes.findIndex(n => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(restNotes, oldIndex, newIndex)
    setNotes([...pinnedNotes, ...reordered.map((n, i) => ({ ...n, sort_order: i }))])

    const updates = reordered.map((n, i) => ({ id: n.id, sort_order: i }))
    await supabase.rpc('reorder_notes', { updates })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    for (const file of files) {
      const text = await file.text()
      let title = file.name.replace(/\.(md|txt|json)$/i, '')
      let content = text

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text)
          title = parsed.title ?? parsed.name ?? title
          content = parsed.content ?? parsed.body ?? text
        } catch { /* use raw text */ }
      } else {
        const firstLine = text.split('\n')[0]
        if (firstLine.startsWith('# ')) title = firstLine.slice(2).trim()
      }

      await supabase.from('notes').insert({ title, content })
    }

    if (importRef.current) importRef.current.value = ''
    router.refresh()
  }

  const filtered = selectedTagId
    ? notes.filter(n => n.note_tags?.some(nt => nt.tags?.id === selectedTagId))
    : notes
  const pinned = filtered.filter(n => n.is_pinned)
  const rest = filtered.filter(n => !n.is_pinned)

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Notes</h1>
        <div className={s.headerActions}>
          <input
            ref={importRef}
            type="file"
            accept=".md,.txt,.json"
            multiple
            className={s.importInput}
            onChange={handleImport}
            id="note-import"
          />
          <label htmlFor="note-import" className={s.importBtn} title="Import notes (.md / .txt / .json)">
            <ImportIcon /> Import
          </label>
          <button className={s.newBtn} onClick={createNote}>+ New note</button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className={s.filters}>
          <button
            className={`${s.filterChip} ${selectedTagId === null ? s.filterActive : ''}`}
            onClick={() => setSelectedTagId(null)}
          >
            All
          </button>
          {tags.map(tag => (
            <button
              key={tag.id}
              className={`${s.filterChip} ${selectedTagId === tag.id ? s.filterActive : ''}`}
              style={selectedTagId === tag.id && tag.color ? { borderColor: tag.color, color: tag.color, background: `${tag.color}18` } : undefined}
              onClick={() => setSelectedTagId(prev => prev === tag.id ? null : tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <>
          <div className={s.section}>Pinned</div>
          <div className={s.grid}>
            {pinned.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          {pinned.length > 0 && <div className={s.section}>Other notes</div>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rest.map(n => n.id)} strategy={rectSortingStrategy}>
              <div className={s.grid}>
                {rest.map(n => <SortableNoteCard key={n.id} note={n} />)}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {filtered.length === 0 && notes.length > 0 && (
        <div className={s.empty}>
          <p>No notes tagged with this category.</p>
        </div>
      )}

      {notes.length === 0 && (
        <div className={s.empty}>
          <p>No notes yet.</p>
          <button className={s.newBtn} onClick={createNote}>Create your first note</button>
        </div>
      )}
    </div>
  )
}

function SortableNoteCard({ note }: { note: Note }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className={s.cardWrapper}>
      <div className={s.dragHandleNote} {...attributes} {...listeners} title="Drag to reorder">
        <GripIcon />
      </div>
      <NoteCard note={note} />
    </div>
  )
}

function NoteCard({ note }: { note: Note }) {
  const snippet = note.content?.replace(/[#*_`[\]]/g, '').trim().slice(0, 140) ?? ''
  const relTime = formatRelative(note.updated_at)
  const tags = note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? []

  return (
    <Link href={`/notes/${note.id}`} className={s.card}>
      {note.color && <div className={s.colorBar} style={{ background: note.color }} />}
      <div className={s.cardBody}>
        <div className={s.cardTitle}>{note.title || 'Untitled'}</div>
        {snippet && <div className={s.cardSnippet}>{snippet}</div>}
        <div className={s.cardMeta}>
          <span className={s.relTime}>{relTime}</span>
          {tags.length > 0 && (
            <div className={s.tags}>
              {tags.slice(0, 2).map(t => (
                <span key={t.id} className={s.tag} style={t.color ? { color: t.color } : undefined}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function GripIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg> }
function ImportIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><polyline points="7 14 12 9 17 14"/></svg> }
