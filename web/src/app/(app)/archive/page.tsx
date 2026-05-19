import { createClient } from '@/lib/supabase/server'
import { NotesList } from '@/components/notes/NotesList'

export const metadata = { title: 'Archive — JustDoIt' }

export default async function ArchivePage() {
  const supabase = await createClient()
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, content, color, is_pinned, updated_at, note_tags(tags(id, name, color))')
    .eq('is_archived', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--jd-fg)', marginBottom: 24 }}>Archive</h1>
      {(notes ?? []).length === 0 ? (
        <p style={{ color: 'var(--jd-fg-dim)' }}>Nothing archived yet.</p>
      ) : (
        <NotesList notes={notes ?? []} />
      )}
    </div>
  )
}
