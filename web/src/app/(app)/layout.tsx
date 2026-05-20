export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: lists }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase
      .from('todo_lists')
      .select('id, title, color, tasks(count)')
      .eq('is_archived', false)
      .order('sort_order')
      .limit(20),
    supabase
      .from('workspace_members')
      .select('workspace_id, accepted_at, workspaces(id, name)')
      .eq('user_id', user.id),
  ])

  const mappedLists = (lists ?? []).map((l: any) => ({
    id: l.id,
    title: l.title,
    color: l.color ?? '#6c63ff',
    open_count: l.tasks?.[0]?.count ?? 0,
  }))

  const workspaces = (memberships ?? [])
    .filter((m: any) => m.accepted_at && m.workspaces)
    .map((m: any) => ({ id: m.workspaces.id as string, name: m.workspaces.name as string }))

  const pendingInviteCount = (memberships ?? []).filter((m: any) => !m.accepted_at).length

  const userData = {
    email: user.email!,
    name: profile?.display_name ?? undefined,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--jd-bg)' }}>
      <Sidebar lists={mappedLists} user={userData} workspaces={workspaces} pendingInviteCount={pendingInviteCount} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar user={userData} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
