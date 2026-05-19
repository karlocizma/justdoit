import { createClient } from '@/lib/supabase/server'
import { NotesList } from '@/components/notes/NotesList'

export const metadata = { title: 'Notes — JustDoIt' }

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, content, color, is_pinned, updated_at, note_tags(tags(id, name, color))')
    .eq('is_archived', false)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100)

  return <NotesList notes={notes ?? []} />
}
