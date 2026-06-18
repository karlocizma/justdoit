import { createClient } from '@/lib/supabase/server'
import { SettingsView } from '@/components/settings/SettingsView'

export const metadata = { title: 'Settings — JustDoIt' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: myMemberships }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, settings').eq('id', user!.id).single(),
    supabase
      .from('workspace_members')
      .select('workspace_id, role, accepted_at, workspaces(id, name)')
      .eq('user_id', user!.id),
  ])

  const memberships = (myMemberships ?? []).map((m: any) => ({
    workspaceId: m.workspace_id as string,
    workspaceName: (m.workspaces?.name ?? 'Unknown') as string,
    role: m.role as string,
    accepted: m.accepted_at !== null,
  }))

  const settings = (profile?.settings ?? {}) as { digest_enabled?: boolean; anthropic_api_key?: string; calendar_feed_token?: string }

  return (
    <SettingsView
      user={{
        id: user!.id,
        email: user!.email!,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      }}
      memberships={memberships}
      digestEnabled={settings.digest_enabled ?? false}
      hasApiKey={!!settings.anthropic_api_key}
      calendarToken={settings.calendar_feed_token ?? null}
    />
  )
}
