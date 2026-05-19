import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NoteEditor } from '@/components/notes/NoteEditor'

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: note } = await supabase
    .from('notes')
    .select('id, title, content, color, is_pinned, updated_at, note_tags(tags(id, name, color))')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!note) notFound()

  return <NoteEditor note={note} />
}
