import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceView } from '@/components/workspaces/WorkspaceView'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: workspace },
    { data: notes },
    { data: lists },
    { data: members },
    { data: recentNotes },
    { data: recentTasks },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('workspaces').select('id, name').eq('id', id).single(),
    supabase
      .from('notes')
      .select('id, title, content, color, is_pinned, updated_at, note_tags(tags(id, name, color))')
      .eq('workspace_id', id)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('todo_lists')
      .select('id, title, color, icon, tasks(count)')
      .eq('workspace_id', id)
      .eq('is_archived', false)
      .order('sort_order'),
    supabase
      .from('workspace_members')
      .select('role, user_id, profiles(display_name, avatar_url)')
      .eq('workspace_id', id)
      .not('accepted_at', 'is', null),
    // Activity: recent notes
    supabase
      .from('notes')
      .select('id, title, updated_at')
      .eq('workspace_id', id)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5),
    // Activity: recent tasks (via workspace lists)
    supabase
      .from('tasks')
      .select('id, title, updated_at, todo_lists!inner(workspace_id)')
      .eq('todo_lists.workspace_id', id)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.auth.getUser(),
  ])

  if (!workspace) notFound()

  const mappedLists = (lists ?? []).map((l: any) => ({
    id: l.id,
    title: l.title,
    color: l.color ?? '#6c63ff',
    icon: l.icon ?? null,
    task_count: l.tasks?.[0]?.count ?? 0,
  }))

  const mappedMembers = (members ?? []).map((m: any) => ({
    userId: m.user_id,
    role: m.role,
    displayName: m.profiles?.display_name ?? null,
  }))

  // Merge and sort activity items
  const activityNotes = (recentNotes ?? []).map((n: any) => ({
    id: n.id, kind: 'note' as const, title: n.title, updatedAt: n.updated_at, href: `/notes/${n.id}`,
  }))
  const activityTasks = (recentTasks ?? []).map((t: any) => ({
    id: t.id, kind: 'task' as const, title: t.title, updatedAt: t.updated_at, href: `/lists`,
  }))
  const activity = [...activityNotes, ...activityTasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)

  return (
    <WorkspaceView
      workspace={workspace}
      notes={notes ?? []}
      lists={mappedLists}
      members={mappedMembers}
      currentUserId={user!.id}
      activity={activity}
    />
  )
}
