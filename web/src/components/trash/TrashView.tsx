'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './TrashView.module.css'

type TrashedNote = { id: string; title: string | null; deleted_at: string | null }

export function TrashView({ notes: initial }: { notes: TrashedNote[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [notes, setNotes] = useState(initial)
  const [pending, setPending] = useState<Set<string>>(new Set())

  async function restore(id: string) {
    setPending(prev => new Set([...prev, id]))
    await supabase.from('notes').update({ deleted_at: null }).eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setPending(prev => { const s = new Set(prev); s.delete(id); return s })
    router.refresh()
  }

  async function hardDelete(id: string) {
    setPending(prev => new Set([...prev, id]))
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setPending(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>Trash</h1>
      <p className={s.subtitle}>Items are permanently deleted after 30 days.</p>

      {notes.length === 0 && <p className={s.empty}>Trash is empty.</p>}

      {notes.length > 0 && (
        <section>
          <div className={s.sectionLabel}>Notes ({notes.length})</div>
          {notes.map(n => (
            <div key={n.id} className={s.row}>
              <div className={s.rowInfo}>
                <span className={s.rowTitle}>{n.title || 'Untitled'}</span>
                <span className={s.rowDate}>
                  {n.deleted_at ? new Date(n.deleted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <div className={s.rowActions}>
                <button
                  className={s.restoreBtn}
                  onClick={() => restore(n.id)}
                  disabled={pending.has(n.id)}
                >
                  Restore
                </button>
                <button
                  className={s.deleteBtn}
                  onClick={() => hardDelete(n.id)}
                  disabled={pending.has(n.id)}
                >
                  Delete forever
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
