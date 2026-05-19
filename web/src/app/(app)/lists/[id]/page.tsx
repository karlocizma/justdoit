import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TasksView } from '@/components/tasks/TasksView'

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return <TasksView list={null} tasks={[]} />

  const supabase = await createClient()
  const [{ data: list }, { data: tasks }] = await Promise.all([
    supabase
      .from('todo_lists')
      .select('id, title, color')
      .eq('id', id)
      .single(),
    supabase
      .from('tasks')
      .select('id, title, notes, priority, due_date, completed_at, sort_order, parent_id')
      .eq('list_id', id)
      .is('parent_id', null)
      .order('sort_order')
      .limit(200),
  ])

  if (!list) notFound()

  return <TasksView list={list} tasks={tasks ?? []} />
}
