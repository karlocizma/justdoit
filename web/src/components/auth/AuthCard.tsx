'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './AuthCard.module.css'

type Mode = 'login' | 'register' | 'forgot' | 'check-email' | 'forgot-sent' | 'reset-password'

export function AuthCard({ initialMode = 'login' }: { initialMode?: Mode }) {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNew, setConfirmNew] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMode('check-email')
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })
    setLoading(false)
    setMode('forgot-sent')
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmNew) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleOAuth(provider: 'github' | 'google') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  if (mode === 'check-email') return (
    <div className={s.card}>
      <div className={s.brand}><Logo /></div>
      <div className={s.checkIcon}><MailIcon /></div>
      <h1 className={s.title}>Check your email</h1>
      <p className={s.subtitle}>
        We sent a confirmation link to <strong style={{ color: 'var(--jd-fg)' }}>{email}</strong>.
        Click it to finish creating your account.
      </p>
      <button className={s.primaryBtn} onClick={() => setMode('login')}>Back to sign in</button>
      <div className={s.footer}>
        Didn&apos;t get it?{' '}
        <button className={s.link} onClick={() => supabase.auth.resend({ type: 'signup', email })}>Resend</button>
      </div>
    </div>
  )

  if (mode === 'forgot-sent') return (
    <div className={s.card}>
      <div className={s.brand}><Logo /></div>
      <div className={s.checkIcon}><MailIcon /></div>
      <h1 className={s.title}>Reset link sent</h1>
      <p className={s.subtitle}>
        If <strong style={{ color: 'var(--jd-fg)' }}>{email}</strong> has an account, a reset link is on its way.
      </p>
      <button className={s.primaryBtn} onClick={() => setMode('login')}>Back to sign in</button>
    </div>
  )

  if (mode === 'reset-password') return (
    <div className={s.card}>
      <div className={s.brand}><Logo /></div>
      <h1 className={s.title}>Set new password</h1>
      <p className={s.subtitle}>Choose a strong password for your account.</p>
      <form onSubmit={handleResetPassword} style={{ display: 'contents' }}>
        {error && <div className={s.error}>{error}</div>}
        <div className={s.field}>
          <label className={s.label}>New password</label>
          <input className={s.input} type="password" required minLength={8}
            placeholder="At least 8 characters" autoFocus
            value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div className={s.field}>
          <label className={s.label}>Confirm new password</label>
          <input className={s.input} type="password" required
            value={confirmNew} onChange={e => setConfirmNew(e.target.value)} />
        </div>
        <button className={s.primaryBtn} type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  )

  if (mode === 'forgot') return (
    <div className={s.card}>
      <div className={s.brand}><Logo /></div>
      <h1 className={s.title}>Reset password</h1>
      <p className={s.subtitle}>Enter your email — we&apos;ll send a reset link.</p>
      <form onSubmit={handleForgot} style={{ display: 'contents' }}>
        {error && <div className={s.error}>{error}</div>}
        <div className={s.field}>
          <label className={s.label}>Email</label>
          <input className={s.input} type="email" required autoFocus
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <button className={s.primaryBtn} type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <div className={s.footer}>
        <button className={s.link} onClick={() => setMode('login')}>Back to sign in</button>
      </div>
    </div>
  )

  const isRegister = mode === 'register'
  return (
    <div className={s.card}>
      <div className={s.brand}><Logo /></div>
      <h1 className={s.title}>{isRegister ? 'Create your account' : 'Sign in'}</h1>
      <p className={s.subtitle}>
        {isRegister ? 'Notes & tasks, done right.' : 'Welcome back. Pick up where you left off.'}
      </p>
      <form onSubmit={isRegister ? handleRegister : handleLogin} style={{ display: 'contents' }}>
        {error && <div className={s.error}>{error}</div>}
        <div className={s.field}>
          <label className={s.label}>Email</label>
          <input className={s.input} type="email" required autoFocus={!isRegister}
            value={email} onChange={e => setEmail(e.target.value)} suppressHydrationWarning />
        </div>
        <div className={s.field}>
          <label className={s.label}>Password</label>
          <input className={s.input} type="password" required minLength={isRegister ? 8 : 1}
            placeholder={isRegister ? 'At least 8 characters' : undefined}
            value={password} onChange={e => setPassword(e.target.value)} suppressHydrationWarning />
        </div>
        {isRegister && (
          <div className={s.field}>
            <label className={s.label}>Confirm password</label>
            <input className={s.input} type="password" required
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
        )}
        {!isRegister && (
          <button type="button" className={s.forgotBtn} onClick={() => setMode('forgot')}>
            Forgot password?
          </button>
        )}
        <button className={s.primaryBtn} type="submit" disabled={loading}>
          {loading ? '…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className={s.divider}>
        <span className={s.dividerLine} /><span>or</span><span className={s.dividerLine} />
      </div>

      <button className={s.oauthBtn} type="button" onClick={() => handleOAuth('github')}>
        <GithubIcon /> Continue with GitHub
      </button>
      <button className={s.oauthBtn} type="button" onClick={() => handleOAuth('google')}>
        <GoogleIcon /> Continue with Google
      </button>

      <div className={s.footer}>
        {isRegister
          ? <>Already have an account?{' '}<button className={s.link} onClick={() => setMode('login')}>Sign in</button></>
          : <>New here?{' '}<button className={s.link} onClick={() => setMode('register')}>Create an account</button></>
        }
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <svg width="34" height="34" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="jd-auth-grad" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(135 .5 .5)">
            <stop offset="0%" stopColor="#6c63ff" />
            <stop offset="100%" stopColor="#48d1cc" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#jd-auth-grad)" />
        <path d="M38 14h-6v26c0 5-2 7-6 7-3 0-5-1-6-3l-4 5c2 3 6 5 11 5 8 0 13-5 13-13V14z" fill="#0f1117" />
        <circle cx="44" cy="48" r="4" fill="#0f1117" />
      </svg>
      <span style={{
        fontFamily: 'var(--jd-font-display)',
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '-0.04em',
        color: 'var(--jd-fg)',
        lineHeight: 1,
      }}>
        justdoit
      </span>
    </div>
  )
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M22 7l-10 7L2 7"/>
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
