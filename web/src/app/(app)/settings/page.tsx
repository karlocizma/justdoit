import { createClient } from '@/lib/supabase/server'
import { SettingsView } from '@/components/settings/SettingsView'

export const metadata = { title: 'Settings — JustDoIt' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user!.id)
    .single()

  return (
    <SettingsView
      user={{
        id: user!.id,
        email: user!.email!,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      }}
    />
  )
}
