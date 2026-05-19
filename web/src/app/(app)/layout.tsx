export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: lists }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase
      .from('todo_lists')
      .select('id, title, color, tasks(count)')
      .eq('is_archived', false)
      .order('sort_order')
      .limit(20),
  ])

  const mappedLists = (lists ?? []).map((l: any) => ({
    id: l.id,
    title: l.title,
    color: l.color ?? '#6c63ff',
    open_count: l.tasks?.[0]?.count ?? 0,
  }))

  const userData = {
    email: user.email!,
    name: profile?.display_name ?? undefined,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--jd-bg)' }}>
      <Sidebar lists={mappedLists} user={userData} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar user={userData} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
