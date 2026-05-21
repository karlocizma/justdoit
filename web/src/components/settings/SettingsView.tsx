'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push'
import s from './SettingsView.module.css'

type User = { id: string; email: string; display_name: string | null; avatar_url: string | null }
type Membership = { workspaceId: string; workspaceName: string; role: string; accepted: boolean }

export function SettingsView({ user, memberships: initialMemberships, digestEnabled: initialDigest, hasApiKey: initialHasApiKey }: {
  user: User
  memberships: Membership[]
  digestEnabled: boolean
  hasApiKey: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  // Profile
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNew, setConfirmNew] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Workspaces
  const [memberships, setMemberships] = useState(initialMemberships)
  const [newWsName, setNewWsName] = useState('')
  const [creatingWs, setCreatingWs] = useState(false)
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({})
  const [inviting, setInviting] = useState<Record<string, boolean>>({})
  const [wsMsg, setWsMsg] = useState<Record<string, string>>({})
  const [expandInvite, setExpandInvite] = useState<Record<string, boolean>>({})

  // Export
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  // Digest
  const [digest, setDigest] = useState(initialDigest)
  const [digestSaving, setDigestSaving] = useState(false)

  // AI key
  const [currentHasKey, setCurrentHasKey] = useState(initialHasApiKey)
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState('')

  // Push notifications
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushMsg, setPushMsg] = useState('')

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (supported) isPushSubscribed().then(setPushEnabled)
  }, [])

  const acceptedWorkspaces = memberships.filter(m => m.accepted)
  const pendingInvites = memberships.filter(m => !m.accepted)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess('Profile saved.')
    router.refresh()
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (newPassword !== confirmNew) { setError('Passwords do not match'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) { setError(error.message); return }
    setNewPassword(''); setConfirmNew('')
    setSuccess('Password changed.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function createWorkspace() {
    if (!newWsName.trim()) return
    setCreatingWs(true)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: newWsName.trim() })
      .select('id, name')
      .single()
    setCreatingWs(false)
    if (error || !data) { setError(error?.message ?? 'Failed to create workspace'); return }
    setMemberships(prev => [...prev, { workspaceId: data.id, workspaceName: data.name, role: 'owner', accepted: true }])
    setNewWsName('')
    router.refresh()
  }

  async function acceptInvite(workspaceId: string) {
    const { error } = await supabase.rpc('accept_workspace_invite', { p_workspace_id: workspaceId })
    if (error) { setWsMsg(prev => ({ ...prev, [workspaceId]: error.message })); return }
    setMemberships(prev => prev.map(m => m.workspaceId === workspaceId ? { ...m, accepted: true } : m))
    router.refresh()
  }

  async function leaveWorkspace(workspaceId: string) {
    if (!confirm('Leave this workspace? You will lose access to its notes and lists.')) return
    await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', user.id)
    setMemberships(prev => prev.filter(m => m.workspaceId !== workspaceId))
    router.refresh()
  }

  async function deleteWorkspace(workspaceId: string, name: string) {
    if (!confirm(`Delete "${name}"? This will permanently remove the workspace and all its shared content for every member.`)) return
    await supabase.from('workspaces').delete().eq('id', workspaceId)
    setMemberships(prev => prev.filter(m => m.workspaceId !== workspaceId))
    router.refresh()
  }

  async function inviteMember(workspaceId: string) {
    const email = inviteEmail[workspaceId]?.trim()
    if (!email) return
    setInviting(prev => ({ ...prev, [workspaceId]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workspace-invite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workspace_id: workspaceId, email }),
    })
    const data = await res.json()
    setInviting(prev => ({ ...prev, [workspaceId]: false }))
    if (!res.ok) {
      setWsMsg(prev => ({ ...prev, [workspaceId]: data.error ?? 'Invite failed' }))
    } else if (data.already_member) {
      setWsMsg(prev => ({ ...prev, [workspaceId]: 'Already a member.' }))
    } else {
      setWsMsg(prev => ({ ...prev, [workspaceId]: `Invite sent to ${email}.` }))
      setInviteEmail(prev => ({ ...prev, [workspaceId]: '' }))
    }
  }

  async function requestExport() {
    setExporting(true)
    setExportMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
    })
    const data = await res.json()
    setExporting(false)
    if (data.scheduled) {
      setExportMsg("Export started! You'll receive an email with a download link when it's ready.")
    } else {
      setExportMsg(data.reason ?? 'Export is not available right now.')
    }
  }

  async function togglePush() {
    setPushSaving(true)
    setPushMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setPushSaving(false); return }
    if (pushEnabled) {
      await unsubscribeFromPush(session.access_token)
      setPushEnabled(false)
      setPushMsg('Push notifications disabled.')
    } else {
      if (Notification.permission === 'denied') {
        setPushMsg('Notifications are blocked in your browser. Please allow them in browser settings.')
        setPushSaving(false)
        return
      }
      const ok = await subscribeToPush(session.access_token)
      if (ok) { setPushEnabled(true); setPushMsg('Push notifications enabled!') }
      else setPushMsg('Could not enable notifications. Check browser permissions.')
    }
    setPushSaving(false)
  }

  async function mergeSettings(patch: Record<string, unknown>) {
    const { data: profile } = await supabase.from('profiles').select('settings').eq('id', user.id).single()
    const merged = { ...(profile?.settings as Record<string, unknown> ?? {}), ...patch }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('profiles').update({ settings: merged as any }).eq('id', user.id)
  }

  async function toggleDigest() {
    const next = !digest
    setDigestSaving(true)
    await mergeSettings({ digest_enabled: next })
    setDigestSaving(false)
    setDigest(next)
  }

  async function saveApiKey(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setApiKeySaving(true)
    setApiKeyMsg('')
    await mergeSettings({ anthropic_api_key: apiKey.trim() })
    setApiKeySaving(false)
    setCurrentHasKey(true)
    setApiKey('')
    setApiKeyMsg('API key saved.')
  }

  async function removeApiKey() {
    setApiKeySaving(true)
    setApiKeyMsg('')
    const { data: profile } = await supabase.from('profiles').select('settings').eq('id', user.id).single()
    const settings = { ...(profile?.settings as Record<string, unknown> ?? {}) }
    delete settings['anthropic_api_key']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('profiles').update({ settings: settings as any }).eq('id', user.id)
    setApiKeySaving(false)
    setCurrentHasKey(false)
    setApiKeyMsg('API key removed.')
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>Settings</h1>

      {/* Profile */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Profile</h2>
        <form onSubmit={saveProfile} className={s.form}>
          {error && <div className={s.error}>{error}</div>}
          {success && <div className={s.success}>{success}</div>}
          <div className={s.field}>
            <label className={s.label}>Email</label>
            <input className={`${s.input} ${s.disabled}`} value={user.email} readOnly />
          </div>
          <div className={s.field}>
            <label className={s.label}>Display name</label>
            <input
              className={s.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <button className={s.saveBtn} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Change password</h2>
        <form onSubmit={changePassword} className={s.form}>
          <div className={s.field}>
            <label className={s.label}>New password</label>
            <input
              className={s.input}
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className={s.field}>
            <label className={s.label}>Confirm new password</label>
            <input
              className={s.input}
              type="password"
              required
              value={confirmNew}
              onChange={e => setConfirmNew(e.target.value)}
            />
          </div>
          <button className={s.saveBtn} type="submit" disabled={saving || !newPassword}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>

      {/* Workspaces */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Workspaces</h2>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className={s.wsBlock}>
            <div className={s.wsSubLabel}>Pending invites</div>
            {pendingInvites.map(m => (
              <div key={m.workspaceId} className={s.wsRow}>
                <div className={s.wsAvatar}>{m.workspaceName.slice(0, 1).toUpperCase()}</div>
                <div className={s.wsName}>{m.workspaceName}</div>
                {wsMsg[m.workspaceId] && <span className={s.wsMsg}>{wsMsg[m.workspaceId]}</span>}
                <button className={s.acceptBtn} onClick={() => acceptInvite(m.workspaceId)}>
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Accepted workspaces */}
        {acceptedWorkspaces.length > 0 && (
          <div className={s.wsBlock}>
            {acceptedWorkspaces.length > 0 && pendingInvites.length > 0 && (
              <div className={s.wsSubLabel}>Your workspaces</div>
            )}
            {acceptedWorkspaces.map(m => (
              <div key={m.workspaceId} className={s.wsCard}>
                <div className={s.wsCardHeader}>
                  <div className={s.wsAvatar}>{m.workspaceName.slice(0, 1).toUpperCase()}</div>
                  <div className={s.wsCardInfo}>
                    <span className={s.wsName}>{m.workspaceName}</span>
                    <span className={s.wsRole}>{m.role}</span>
                  </div>
                  <div className={s.wsCardActions}>
                    {(m.role === 'owner' || m.role === 'admin') && (
                      <button
                        className={s.inviteToggle}
                        onClick={() => setExpandInvite(prev => ({ ...prev, [m.workspaceId]: !prev[m.workspaceId] }))}
                      >
                        Invite member
                      </button>
                    )}
                    {m.role !== 'owner' && (
                      <button className={s.leaveBtn} onClick={() => leaveWorkspace(m.workspaceId)}>
                        Leave
                      </button>
                    )}
                    {m.role === 'owner' && (
                      <button className={s.leaveBtn} onClick={() => deleteWorkspace(m.workspaceId, m.workspaceName)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {expandInvite[m.workspaceId] && (
                  <div className={s.inviteForm}>
                    <input
                      className={s.inviteInput}
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail[m.workspaceId] ?? ''}
                      onChange={e => setInviteEmail(prev => ({ ...prev, [m.workspaceId]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && inviteMember(m.workspaceId)}
                    />
                    <button
                      className={s.saveBtn}
                      onClick={() => inviteMember(m.workspaceId)}
                      disabled={inviting[m.workspaceId] || !inviteEmail[m.workspaceId]?.trim()}
                    >
                      {inviting[m.workspaceId] ? 'Sending…' : 'Send invite'}
                    </button>
                  </div>
                )}
                {wsMsg[m.workspaceId] && <div className={s.wsMsg}>{wsMsg[m.workspaceId]}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Create new workspace */}
        <div className={s.wsCreate}>
          <div className={s.wsSubLabel} style={{ marginBottom: 10 }}>
            {acceptedWorkspaces.length === 0 ? 'No workspaces yet' : 'Create new workspace'}
          </div>
          <div className={s.inviteForm}>
            <input
              className={s.inviteInput}
              placeholder="Workspace name"
              value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createWorkspace()}
            />
            <button
              className={s.saveBtn}
              onClick={createWorkspace}
              disabled={creatingWs || !newWsName.trim()}
            >
              {creatingWs ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </section>

      {/* Push notifications */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Push notifications</h2>
        {!pushSupported ? (
          <p className={s.exportDesc}>Your browser does not support push notifications.</p>
        ) : (
          <>
            <div className={s.toggleRow}>
              <div className={s.toggleInfo}>
                <div className={s.toggleLabel}>Browser notifications</div>
                <div className={s.toggleDesc}>Receive reminders and alerts as browser notifications, even when the app is in the background.</div>
              </div>
              <button
                className={`${s.toggle} ${pushEnabled ? s.toggleOn : ''}`}
                onClick={togglePush}
                disabled={pushSaving}
                aria-pressed={pushEnabled}
              >
                <span className={s.toggleThumb} />
              </button>
            </div>
            {pushMsg && <div className={pushMsg.includes('enabled') ? s.success : s.error}>{pushMsg}</div>}
            {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
              <div className={s.error} style={{ marginTop: 8 }}>
                NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Push notifications require VAPID keys — see the deployment guide.
              </div>
            )}
          </>
        )}
      </section>

      {/* Email preferences */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Email preferences</h2>
        <div className={s.toggleRow}>
          <div className={s.toggleInfo}>
            <div className={s.toggleLabel}>Daily digest</div>
            <div className={s.toggleDesc}>Receive a morning email with your tasks due today and overdue items.</div>
          </div>
          <button
            className={`${s.toggle} ${digest ? s.toggleOn : ''}`}
            onClick={toggleDigest}
            disabled={digestSaving}
            aria-pressed={digest}
          >
            <span className={s.toggleThumb} />
          </button>
        </div>
      </section>

      {/* AI */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>AI</h2>
        <p className={s.exportDesc}>
          Enable AI features (note summarization, tag suggestions, task extraction, smart search) with your own{' '}
          <a className={s.link} href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
            Anthropic API key
          </a>. The key is stored in your account and used server-side only.
        </p>
        {apiKeyMsg && (
          <div className={apiKeyMsg.startsWith('Failed') ? s.error : s.success}>{apiKeyMsg}</div>
        )}
        {currentHasKey && (
          <div className={s.apiKeyStatus}>
            <span className={s.apiKeyConfigured}>API key configured ✓</span>
            <button className={s.leaveBtn} onClick={removeApiKey} disabled={apiKeySaving}>Remove</button>
          </div>
        )}
        <form onSubmit={saveApiKey} className={s.form} style={{ marginTop: currentHasKey ? 12 : 0 }}>
          <div className={s.field}>
            <label className={s.label}>{currentHasKey ? 'Replace key' : 'API key'}</label>
            <input
              className={s.input}
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button className={s.saveBtn} type="submit" disabled={apiKeySaving || !apiKey.trim()}>
            {apiKeySaving ? 'Saving…' : 'Save key'}
          </button>
        </form>
      </section>

      {/* Export */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Export your data</h2>
        <p className={s.exportDesc}>
          Download all your notes and tasks as a ZIP archive. You&apos;ll receive an email with a download link.
        </p>
        {exportMsg && <div className={exportMsg.includes('started') ? s.success : s.error}>{exportMsg}</div>}
        <button className={s.saveBtn} onClick={requestExport} disabled={exporting}>
          {exporting ? 'Requesting…' : 'Export data'}
        </button>
      </section>

      {/* Account */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Account</h2>
        <button className={s.dangerBtn} onClick={signOut}>Sign out</button>
      </section>
    </div>
  )
}
