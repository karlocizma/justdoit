import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/CalendarView'

export const metadata = { title: 'Calendar — JustDoIt' }

export default async function CalendarPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: notes }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, priority, due_date, completed_at, list_id, todo_lists(title, color)')
      .not('due_date', 'is', null)
      .order('due_date'),
    supabase
      .from('notes')
      .select('id, title, due_at, color')
      .not('due_at', 'is', null)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('due_at'),
  ])

  return <CalendarView tasks={tasks ?? []} notes={notes ?? []} />
}
