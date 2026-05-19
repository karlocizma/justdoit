'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './NotesList.module.css'

type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; updated_at: string; note_tags: NoteTag[] }

export function NotesList({ notes }: { notes: Note[] }) {
  const router = useRouter()
  const supabase = createClient()

  async function createNote() {
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'Untitled', content: '' })
      .select('id')
      .single()
    if (data) router.push(`/notes/${data.id}`)
  }

  const pinned = notes.filter(n => n.is_pinned)
  const rest = notes.filter(n => !n.is_pinned)

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Notes</h1>
        <button className={s.newBtn} onClick={createNote}>+ New note</button>
      </div>

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
          <div className={s.grid}>
            {rest.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        </>
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
