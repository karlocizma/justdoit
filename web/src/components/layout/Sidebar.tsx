'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import s from './Sidebar.module.css'

type List = { id: string; title: string; color: string; open_count: number }
type Workspace = { id: string; name: string }
type User = { email: string; name?: string }

export function Sidebar({ lists, user, workspaces = [], pendingInviteCount = 0 }: {
  lists: List[]
  user: User
  workspaces?: Workspace[]
  pendingInviteCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const footerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const initial = (user.name ?? user.email).slice(0, 2).toUpperCase()

  function openUserMenu() {
    if (footerRef.current) {
      const r = footerRef.current.getBoundingClientRect()
      setMenuPos({ top: r.top - 8, left: r.left })
    }
    setUserMenuOpen(true)
  }

  useEffect(() => {
    if (!userMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = (href: string) => `${s.navItem}${pathname === href || pathname.startsWith(href + '/') ? ' ' + s.active : ''}`

  return (
    <>
      <aside className={s.root}>
        <div className={s.brand}>
          <BrandLogo />
        </div>

        <div className={s.navList}>
          <Link href="/dashboard" className={nav('/dashboard')}>
            <span className={s.navIcon}><HomeIcon /></span>
            <span className={s.navLabel}>Today</span>
          </Link>
          <Link href="/notes" className={nav('/notes')}>
            <span className={s.navIcon}><NoteIcon /></span>
            <span className={s.navLabel}>Notes</span>
          </Link>
        </div>

        <div className={s.section}>Personal</div>
        <div className={s.scrollLists}>
          <div className={s.navList}>
            {lists.map(l => (
              <Link key={l.id} href={`/lists/${l.id}`} className={nav(`/lists/${l.id}`)}>
                <span className={s.navColor} style={{ background: l.color }} />
                <span className={s.navLabel}>{l.title}</span>
                {l.open_count > 0 && <span className={s.navCount}>{l.open_count}</span>}
              </Link>
            ))}
            <Link href="/lists/new" className={s.navItem}>
              <span className={s.navIcon}><PlusIcon /></span>
              <span className={s.navLabel} style={{ color: 'var(--jd-fg-dim)' }}>New list</span>
            </Link>
          </div>
        </div>

        {workspaces.length > 0 && (
          <>
            <div className={s.section}>Workspaces</div>
            <div className={s.navList}>
              {workspaces.map(ws => (
                <Link key={ws.id} href={`/workspaces/${ws.id}`} className={nav(`/workspaces/${ws.id}`)}>
                  <span className={s.wsIcon}>{ws.name.slice(0, 1).toUpperCase()}</span>
                  <span className={s.navLabel}>{ws.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className={s.navList}>
          <Link href="/archive" className={nav('/archive')}>
            <span className={s.navIcon}><ArchiveIcon /></span>
            <span className={s.navLabel}>Archive</span>
          </Link>
          <Link href="/trash" className={nav('/trash')}>
            <span className={s.navIcon}><TrashIcon /></span>
            <span className={s.navLabel}>Trash</span>
          </Link>
          <Link href="/settings" className={nav('/settings')}>
            <span className={s.navIcon}><SettingsIcon /></span>
            <span className={s.navLabel}>Settings</span>
            {pendingInviteCount > 0 && (
              <span className={s.inviteBadge}>{pendingInviteCount}</span>
            )}
          </Link>
        </div>

        <div className={s.footer} ref={footerRef} onClick={openUserMenu}>
          <div className={s.footerAvatar}>{initial}</div>
          <div className={s.footerInfo}>
            <div className={s.footerName}>{user.name ?? user.email.split('@')[0]}</div>
            <div className={s.footerEmail}>{user.email}</div>
          </div>
          <span className={s.footerChevron}><ChevronUpIcon /></span>
        </div>
      </aside>

      {userMenuOpen && (
        <div
          ref={menuRef}
          className={s.menu}
          style={{ top: menuPos.top, left: menuPos.left, transform: 'translateY(-100%)' }}
        >
          <div className={s.menuMeta}>{user.email}</div>
          <button className={s.menuItem} onClick={() => { setUserMenuOpen(false); router.push('/settings') }}>
            <SettingsIcon /> Settings
          </button>
          <button className={s.menuItem} onClick={() => { setUserMenuOpen(false); router.push('/archive') }}>
            <ArchiveIcon /> Archive
          </button>
          <button className={s.menuItem} onClick={() => { setUserMenuOpen(false); router.push('/trash') }}>
            <TrashIcon /> Trash
          </button>
          <div style={{ height: 1, background: 'var(--jd-border-soft)', margin: '4px 0' }} />
          <button className={`${s.menuItem} ${s.danger}`} onClick={signOut}>Sign out</button>
        </div>
      )}
    </>
  )
}

function BrandLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="jd-sidebar-grad" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(135 .5 .5)">
            <stop offset="0%" stopColor="#6c63ff" />
            <stop offset="100%" stopColor="#48d1cc" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#jd-sidebar-grad)" />
        <path d="M38 14h-6v26c0 5-2 7-6 7-3 0-5-1-6-3l-4 5c2 3 6 5 11 5 8 0 13-5 13-13V14z" fill="#0f1117" />
        <circle cx="44" cy="48" r="4" fill="#0f1117" />
      </svg>
      <span style={{
        fontFamily: 'var(--jd-font-display)',
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: '-0.04em',
        color: 'var(--jd-fg)',
        lineHeight: 1,
      }}>
        justdoit
      </span>
    </div>
  )
}

function HomeIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function NoteIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function ArchiveIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function ChevronUpIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg> }
