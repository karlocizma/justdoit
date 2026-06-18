import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NoteEditor } from '@/components/notes/NoteEditor'

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: note } = await supabase
    .from('notes')
    .select('id, title, content, color, is_pinned, due_at, updated_at, workspace_id, note_tags(tags(id, name, color))')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!note) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  return <NoteEditor note={note} currentUserId={user?.id ?? null} />
}
