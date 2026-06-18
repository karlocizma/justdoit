import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminDashboard, type AdminStats } from '@/components/admin/AdminDashboard'

export const metadata = { title: 'Admin — JustDoIt' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Gate the route on the global admin flag. Non-admins get a 404 (don't reveal
  // the page exists). The Edge Function re-checks this server-side regardless.
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) notFound()

  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 40px' }}>
        <h1>Admin</h1>
        <p style={{ color: 'var(--jd-danger)' }}>Could not load admin stats ({res.status}).</p>
      </div>
    )
  }

  const stats = (await res.json()) as AdminStats
  return <AdminDashboard stats={stats} />
}
