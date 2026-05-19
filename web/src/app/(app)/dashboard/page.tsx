import { createClient } from '@/lib/supabase/server'
import { DashboardView } from '@/components/dashboard/DashboardView'

export const metadata = { title: 'Today — JustDoIt' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: notes }, { data: tasks }] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, content, color, is_pinned, updated_at, note_tags(tags(id, name, color))')
      .eq('is_archived', false)
      .is('deleted_at', null)
      .eq('is_pinned', true)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('tasks')
      .select('id, title, priority, due_date, completed_at, list_id, todo_lists(title, color)')
      .lte('due_date', today)
      .is('completed_at', null)
      .order('due_date')
      .limit(50),
  ])

  return <DashboardView notes={notes ?? []} tasks={tasks ?? []} userId={user!.id} />
}
