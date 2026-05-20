import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/CalendarView'

export const metadata = { title: 'Calendar — JustDoIt' }

export default async function CalendarPage() {
  const supabase = await createClient()

  // Fetch tasks that have a due date (not completed, not in trash)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, priority, due_date, completed_at, list_id, todo_lists(title, color)')
    .not('due_date', 'is', null)
    .order('due_date')

  return <CalendarView tasks={tasks ?? []} />
}
