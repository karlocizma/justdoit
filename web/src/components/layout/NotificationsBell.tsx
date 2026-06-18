'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import s from './NotificationsBell.module.css'

type Mention = {
  id: string
  source_type: 'note' | 'task'
  source_id: string
  context: string | null
  is_read: boolean
  created_at: string
}

function sourceUrl(m: Mention) {
  return m.source_type === 'note' ? `/notes/${m.source_id}` : '/dashboard'
}

export function NotificationsBell({ userId }: { userId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const unread = mentions.filter(m => !m.is_read).length

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mentions')
      .select('id, source_type, source_id, context, is_read, created_at')
      .eq('mentioned_user', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setMentions((data ?? []) as Mention[])
  }, [supabase])

  // Initial load + realtime updates for this user's mentions.
  useEffect(() => {
    void load()
    const channel: RealtimeChannel = supabase
      .channel(`mentions:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mentions', filter: `mentioned_user=eq.${userId}` },
        payload => setMentions(prev => [payload.new as Mention, ...prev].slice(0, 20)),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, userId, load])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function openMention(m: Mention) {
    setOpen(false)
    if (!m.is_read) {
      setMentions(prev => prev.map(x => (x.id === m.id ? { ...x, is_read: true } : x)))
      await supabase.from('mentions').update({ is_read: true }).eq('id', m.id)
    }
    router.push(sourceUrl(m))
  }

  async function markAllRead() {
    const ids = mentions.filter(m => !m.is_read).map(m => m.id)
    if (ids.length === 0) return
    setMentions(prev => prev.map(m => ({ ...m, is_read: true })))
    await supabase.from('mentions').update({ is_read: true }).in('id', ids)
  }

  return (
    <div className={s.wrap} ref={ref}>
      <button
        className={s.bell}
        onClick={() => setOpen(o => !o)}
        title="Mentions"
        aria-label={unread > 0 ? `${unread} unread mentions` : 'Mentions'}
      >
        <BellIcon />
        {unread > 0 && <span className={s.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className={s.dropdown}>
          <div className={s.header}>
            <span className={s.title}>Mentions</span>
            {unread > 0 && <button className={s.markAll} onClick={markAllRead}>Mark all read</button>}
          </div>
          {mentions.length === 0 ? (
            <p className={s.empty}>No mentions yet.</p>
          ) : (
            <ul className={s.list}>
              {mentions.map(m => (
                <li key={m.id}>
                  <button
                    className={`${s.item} ${m.is_read ? '' : s.unread}`}
                    onClick={() => openMention(m)}
                  >
                    <span className={s.itemText}>
                      Mentioned in {m.context ? `“${m.context}”` : 'a workspace item'}
                    </span>
                    <span className={s.itemTime}>{formatRelative(m.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}
