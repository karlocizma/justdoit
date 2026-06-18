import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TasksView } from '@/components/tasks/TasksView'

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return <TasksView list={null} tasks={[]} />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: list }, { data: tasks }] = await Promise.all([
    supabase
      .from('todo_lists')
      .select('id, title, color, workspace_id')
      .eq('id', id)
      .single(),
    supabase
      .from('tasks')
      .select('id, list_id, title, notes, priority, is_completed, due_date, due_time, recurrence, completed_at, sort_order, parent_id, status, assigned_to, created_at, updated_at')
      .eq('list_id', id)
      .is('parent_id', null)
      .order('sort_order')
      .limit(200),
  ])

  if (!list) notFound()

  let members: { userId: string; displayName: string | null }[] = []
  if (list.workspace_id) {
    const { data: wm } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', list.workspace_id)
    if (wm && wm.length > 0) {
      const userIds = wm.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))
      members = userIds.map(uid => ({ userId: uid, displayName: profileMap.get(uid) ?? null }))
    }
  }

  type TaskRow = {
    id: string; title: string; notes: string | null; priority: number
    due_date: string | null; completed_at: string | null; sort_order: number
    parent_id: string | null; status: string; assigned_to: string | null
  }
  const normalizedTasks: TaskRow[] = ((tasks ?? []) as unknown as TaskRow[]).map(t => ({
    ...t,
    status: t.status ?? 'todo',
    assigned_to: t.assigned_to ?? null,
  }))

  return (
    <TasksView
      list={list}
      tasks={normalizedTasks}
      members={members}
      currentUserId={user?.id}
    />
  )
}
