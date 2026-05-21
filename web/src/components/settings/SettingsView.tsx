'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push'
import s from './SettingsView.module.css'

type User = { id: string; email: string; display_name: string | null; avatar_url: string | null }
type Membership = { workspaceId: string; workspaceName: string; role: string; accepted: boolean }
type Section = 'profile' | 'password' | 'workspaces' | 'notifications' | 'ai' | 'security' | 'export' | 'account'

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Profile',        icon: <UserIcon /> },
  { id: 'password',      label: 'Password',       icon: <LockIcon /> },
  { id: 'workspaces',    label: 'Workspaces',     icon: <WorkspaceIcon /> },
  { id: 'notifications', label: 'Notifications',  icon: <BellIcon /> },
  { id: 'ai',            label: 'AI',             icon: <SparkIcon /> },
  { id: 'security',      label: 'Security',       icon: <ShieldIcon /> },
  { id: 'export',        label: 'Export',         icon: <DownloadIcon /> },
  { id: 'account',       label: 'Account',        icon: <AccountIcon /> },
]

export function SettingsView({ user, memberships: initialMemberships, digestEnabled: initialDigest, hasApiKey: initialHasApiKey }: {
  user: User
  memberships: Membership[]
  digestEnabled: boolean
  hasApiKey: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [active, setActive] = useState<Section>('profile')

  // Profile
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmNew, setConfirmNew] = useState('')

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

  // 2FA
  type TotpFactor = { id: string; friendly_name?: string }
  const [totpFactors, setTotpFactors] = useState<TotpFactor[]>([])
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [tfaMsg, setTfaMsg] = useState('')
  const [tfaLoading, setTfaLoading] = useState(false)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (supported) isPushSubscribed().then(setPushEnabled)
  }, [])

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setTotpFactors((data?.totp ?? []) as TotpFactor[])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const acceptedWorkspaces = memberships.filter(m => m.accepted)
  const pendingInvites = memberships.filter(m => !m.accepted)

  function switchSection(id: Section) {
    setActive(id)
    setError('')
    setSuccess('')
  }

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

  async function startEnroll() {
    setTfaMsg('')
    setTfaLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    setTfaLoading(false)
    if (error || !data) { setTfaMsg(error?.message ?? 'Enrollment failed'); return }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setTotpCode('')
  }

  async function verifyEnroll() {
    if (!enrollData) return
    setTfaLoading(true)
    setTfaMsg('')
    const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId })
    if (challengeErr || !challengeData) { setTfaMsg(challengeErr?.message ?? 'Challenge failed'); setTfaLoading(false); return }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: enrollData.factorId, challengeId: challengeData.id, code: totpCode })
    setTfaLoading(false)
    if (verifyErr) { setTfaMsg('Invalid code. Try again.'); return }
    setEnrollData(null)
    setTotpCode('')
    setTfaMsg('Two-factor authentication enabled!')
    setTotpFactors(prev => [...prev, { id: enrollData.factorId }])
  }

  async function unenrollFactor(factorId: string) {
    if (!confirm('Disable two-factor authentication? Your account will be less secure.')) return
    setTfaLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setTfaLoading(false)
    if (error) { setTfaMsg(error.message); return }
    setTotpFactors(prev => prev.filter(f => f.id !== factorId))
    setTfaMsg('Two-factor authentication disabled.')
  }

  return (
    <div className={s.root}>
      {/* Left nav */}
      <nav className={s.nav}>
        <div className={s.navHeader}>Settings</div>
        {NAV.map(item => (
          <button
            key={item.id}
            className={`${s.navItem} ${active === item.id ? s.navItemActive : ''}`}
            onClick={() => switchSection(item.id)}
          >
            <span className={s.navIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div className={s.content}>
        <h2 className={s.contentTitle}>{NAV.find(n => n.id === active)?.label}</h2>

        {/* ── Profile ── */}
        {active === 'profile' && (
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
        )}

        {/* ── Password ── */}
        {active === 'password' && (
          <form onSubmit={changePassword} className={s.form}>
            {error && <div className={s.error}>{error}</div>}
            {success && <div className={s.success}>{success}</div>}
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
        )}

        {/* ── Workspaces ── */}
        {active === 'workspaces' && (
          <div>
            {pendingInvites.length > 0 && (
              <div className={s.wsBlock}>
                <div className={s.wsSubLabel}>Pending invites</div>
                {pendingInvites.map(m => (
                  <div key={m.workspaceId} className={s.wsRow}>
                    <div className={s.wsAvatar}>{m.workspaceName.slice(0, 1).toUpperCase()}</div>
                    <div className={s.wsName}>{m.workspaceName}</div>
                    {wsMsg[m.workspaceId] && <span className={s.wsMsg}>{wsMsg[m.workspaceId]}</span>}
                    <button className={s.acceptBtn} onClick={() => acceptInvite(m.workspaceId)}>Accept</button>
                  </div>
                ))}
              </div>
            )}

            {acceptedWorkspaces.length > 0 && (
              <div className={s.wsBlock}>
                {pendingInvites.length > 0 && <div className={s.wsSubLabel}>Your workspaces</div>}
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
                          <button className={s.leaveBtn} onClick={() => leaveWorkspace(m.workspaceId)}>Leave</button>
                        )}
                        {m.role === 'owner' && (
                          <button className={s.leaveBtn} onClick={() => deleteWorkspace(m.workspaceId, m.workspaceName)}>Delete</button>
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
                <button className={s.saveBtn} onClick={createWorkspace} disabled={creatingWs || !newWsName.trim()}>
                  {creatingWs ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {active === 'notifications' && (
          <div className={s.form}>
            <div className={s.fieldGroup}>
              <div className={s.fieldGroupTitle}>Push notifications</div>
              {!pushSupported ? (
                <p className={s.desc}>Your browser does not support push notifications.</p>
              ) : (
                <>
                  <div className={s.toggleRow}>
                    <div className={s.toggleInfo}>
                      <div className={s.toggleLabel}>Browser notifications</div>
                      <div className={s.toggleDesc}>Receive reminders and alerts even when the app is in the background.</div>
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
                    <div className={s.error}>
                      NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Push notifications require VAPID keys — see the deployment guide.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={s.divider} />

            <div className={s.fieldGroup}>
              <div className={s.fieldGroupTitle}>Email preferences</div>
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
            </div>
          </div>
        )}

        {/* ── AI ── */}
        {active === 'ai' && (
          <div className={s.form}>
            <p className={s.desc}>
              Enable AI features (note summarization, tag suggestions, task extraction, smart search) with your own{' '}
              <a className={s.link} href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                Anthropic API key
              </a>. The key is stored server-side and never exposed to the browser.
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
          </div>
        )}

        {/* ── Security (2FA) ── */}
        {active === 'security' && (
          <div className={s.form}>
            <div className={s.fieldGroup}>
              <div className={s.fieldGroupTitle}>Two-factor authentication</div>
              <p className={s.desc}>
                Add an extra layer of security with a TOTP authenticator app (Google Authenticator, 1Password, Authy, etc.).
              </p>
              {tfaMsg && (
                <div className={tfaMsg.includes('enabled') || tfaMsg.includes('disabled') ? s.success : s.error}>
                  {tfaMsg}
                </div>
              )}
              {totpFactors.length > 0 ? (
                <div className={s.tfaActive}>
                  <span className={s.apiKeyConfigured}>2FA enabled ✓</span>
                  {totpFactors.map(f => (
                    <button key={f.id} className={s.leaveBtn} onClick={() => unenrollFactor(f.id)} disabled={tfaLoading}>
                      Disable
                    </button>
                  ))}
                </div>
              ) : enrollData ? (
                <div className={s.enrollWrap}>
                  <p className={s.desc}>
                    Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollData.qrCode} alt="TOTP QR code" className={s.qrCode} />
                  <div className={s.secret}>{enrollData.secret}</div>
                  <div className={s.field}>
                    <label className={s.label}>6-digit code</label>
                    <input
                      className={s.input}
                      placeholder="000000"
                      maxLength={6}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && totpCode.length === 6 && verifyEnroll()}
                      autoFocus
                    />
                  </div>
                  <div className={s.enrollActions}>
                    <button className={s.saveBtn} onClick={verifyEnroll} disabled={tfaLoading || totpCode.length !== 6}>
                      {tfaLoading ? 'Verifying…' : 'Verify & enable'}
                    </button>
                    <button className={s.leaveBtn} onClick={() => { setEnrollData(null); setTotpCode(''); setTfaMsg('') }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className={s.saveBtn} onClick={startEnroll} disabled={tfaLoading}>
                  {tfaLoading ? 'Loading…' : 'Enable 2FA'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Export ── */}
        {active === 'export' && (
          <div className={s.form}>
            <p className={s.desc}>
              Download all your notes and tasks as a ZIP archive. You&apos;ll receive an email with a download link when it&apos;s ready.
            </p>
            {exportMsg && <div className={exportMsg.includes('started') ? s.success : s.error}>{exportMsg}</div>}
            <button className={s.saveBtn} onClick={requestExport} disabled={exporting}>
              {exporting ? 'Requesting…' : 'Export data'}
            </button>
          </div>
        )}

        {/* ── Account ── */}
        {active === 'account' && (
          <div className={s.form}>
            <div className={s.field}>
              <label className={s.label}>Signed in as</label>
              <div className={s.accountEmail}>{user.email}</div>
            </div>
            <div className={s.divider} />
            <button className={s.dangerBtn} onClick={signOut}>Sign out</button>
          </div>
        )}
      </div>
    </div>
  )
}

function UserIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> }
function WorkspaceIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> }
function BellIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> }
function SparkIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function ShieldIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
function DownloadIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function AccountIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
