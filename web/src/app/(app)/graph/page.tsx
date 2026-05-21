import { createClient } from '@/lib/supabase/server'
import { NoteGraph } from '@/components/graph/NoteGraph'

export const metadata = { title: 'Note Graph — JustDoIt' }

export default async function GraphPage() {
  const supabase = await createClient()

  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, content')
    .is('deleted_at', null)
    .eq('is_archived', false)

  return <NoteGraph notes={notes ?? []} />
}
