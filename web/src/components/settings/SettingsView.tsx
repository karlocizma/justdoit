'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './SettingsView.module.css'

type User = { id: string; email: string; display_name: string | null; avatar_url: string | null }

export function SettingsView({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNew, setConfirmNew] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  return (
    <div className={s.root}>
      <h1 className={s.title}>Settings</h1>

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

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Account</h2>
        <button className={s.dangerBtn} onClick={signOut}>Sign out</button>
      </section>
    </div>
  )
}
