'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { reorderLists } from '@/lib/offline'
import s from './Sidebar.module.css'

type List = { id: string; title: string; color: string; open_count: number }
type Workspace = { id: string; name: string }
type User = { email: string; name?: string }

export function Sidebar({ lists: initialLists, user, workspaces = [], pendingInviteCount = 0 }: {
  lists: List[]
  user: User
  workspaces?: Workspace[]
  pendingInviteCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [lists, setLists] = useState(initialLists)
  const [mounted, setMounted] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const footerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const initial = (user.name ?? user.email).slice(0, 2).toUpperCase()

  function openUserMenu() {
    if (footerRef.current) {
      const r = footerRef.current.getBoundingClientRect()
      setMenuPos({ top: r.top - 8, left: r.left })
    }
    setUserMenuOpen(true)
  }

  useEffect(() => { setMounted(true) }, [])

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

  async function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = lists.findIndex(l => l.id === active.id)
    const newIndex = lists.findIndex(l => l.id === over.id)
    const reordered = arrayMove(lists, oldIndex, newIndex)
    setLists(reordered)
    await reorderLists(reordered.map(l => l.id))
  }

  const nav = (href: string) => `${s.navItem}${pathname === href || pathname.startsWith(href + '/') ? ' ' + s.active : ''}`

  return (
    <>
      <aside className={s.root} data-role="sidebar">
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
          <Link href="/calendar" className={nav('/calendar')}>
            <span className={s.navIcon}><CalendarIcon /></span>
            <span className={s.navLabel}>Calendar</span>
          </Link>
          <Link href="/graph" className={nav('/graph')}>
            <span className={s.navIcon}><GraphIcon /></span>
            <span className={s.navLabel}>Graph</span>
          </Link>
        </div>

        <div className={s.section}>Personal</div>
        <div className={s.scrollLists}>
          {mounted ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
              <SortableContext items={lists.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className={s.navList}>
                  {lists.map(l => (
                    <SortableListItem key={l.id} list={l} isActive={pathname === `/lists/${l.id}` || pathname.startsWith(`/lists/${l.id}/`)} />
                  ))}
                  <Link href="/lists/new" className={s.navItem}>
                    <span className={s.navIcon}><PlusIcon /></span>
                    <span className={s.navLabel} style={{ color: 'var(--jd-fg-dim)' }}>New list</span>
                  </Link>
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className={s.navList}>
              {lists.map(l => (
                <Link key={l.id} href={`/lists/${l.id}`} className={`${s.navItem} ${pathname === `/lists/${l.id}` || pathname.startsWith(`/lists/${l.id}/`) ? s.active : ''}`}>
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
          )}
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

function SortableListItem({ list, isActive }: { list: List; isActive: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`${s.sortableRow} ${isActive ? s.active : ''}`}>
      <span className={s.listDragHandle} {...attributes} {...listeners}><GripSmIcon /></span>
      <Link href={`/lists/${list.id}`} className={s.sortableLink}>
        <span className={s.navColor} style={{ background: list.color }} />
        <span className={s.navLabel}>{list.title}</span>
        {list.open_count > 0 && <span className={s.navCount}>{list.open_count}</span>}
      </Link>
    </div>
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
function CalendarIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function GraphIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="11.2" x2="17" y2="6.3"/><line x1="7" y1="12.8" x2="17" y2="17.7"/></svg> }
function GripSmIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/><circle cx="9" cy="19" r="1.2" fill="currentColor"/><circle cx="15" cy="19" r="1.2" fill="currentColor"/></svg> }
