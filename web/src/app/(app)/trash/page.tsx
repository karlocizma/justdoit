import { createClient } from '@/lib/supabase/server'
import { TrashView } from '@/components/trash/TrashView'

export const metadata = { title: 'Trash — JustDoIt' }

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(50)

  return <TrashView notes={notes ?? []} />
}
