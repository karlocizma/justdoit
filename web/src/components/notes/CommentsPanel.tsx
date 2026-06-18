'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isOnline } from '@/lib/offline/status'
import s from './CommentsPanel.module.css'

type Comment = {
  id: string
  note_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

type Profile = { id: string; display_name: string | null }

export function CommentsPanel({
  noteId,
  currentUserId,
}: {
  noteId: string
  currentUserId: string | null
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [offline, setOffline] = useState(false)
  const profilesRef = useRef(profiles)
  profilesRef.current = profiles

  // Fetch display names for any author ids we don't have yet.
  const ensureProfiles = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter(id => !profilesRef.current[id])
    if (missing.length === 0) return
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', missing)
    if (data?.length) {
      setProfiles(prev => {
        const next = { ...prev }
        for (const p of data) next[p.id] = p
        return next
      })
    }
  }, [supabase])

  // Load comments when the panel is first opened.
  useEffect(() => {
    if (!open || loaded) return
    if (!isOnline()) { setOffline(true); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('note_comments')
        .select('id, note_id, user_id, content, created_at, updated_at')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) { setOffline(true); return }
      setComments(data ?? [])
      setLoaded(true)
      void ensureProfiles((data ?? []).map(c => c.user_id))
    })()
    return () => { cancelled = true }
  }, [open, loaded, noteId, supabase, ensureProfiles])

  // Subscribe to live changes while the panel is open.
  useEffect(() => {
    if (!open || !loaded) return
    const channel: RealtimeChannel = supabase
      .channel(`note-comments:${noteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_comments', filter: `note_id=eq.${noteId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Comment
            setComments(prev => (prev.some(c => c.id === row.id) ? prev : [...prev, row]))
            void ensureProfiles([row.user_id])
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Comment
            setComments(prev => prev.map(c => (c.id === row.id ? row : c)))
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as Comment
            setComments(prev => prev.filter(c => c.id !== row.id))
          }
        },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [open, loaded, noteId, supabase, ensureProfiles])

  async function post() {
    const content = draft.trim()
    if (!content || posting) return
    setPosting(true)
    const { data, error } = await supabase
      .from('note_comments')
      .insert({ note_id: noteId, content })
      .select('id, note_id, user_id, content, created_at, updated_at')
      .single()
    setPosting(false)
    if (error || !data) return
    setDraft('')
    // Optimistically append; the realtime echo is de-duped by id.
    setComments(prev => (prev.some(c => c.id === data.id) ? prev : [...prev, data]))
    void ensureProfiles([data.user_id])
  }

  async function saveEdit(id: string) {
    const content = editDraft.trim()
    if (!content) return
    const { data } = await supabase
      .from('note_comments')
      .update({ content })
      .eq('id', id)
      .select('id, note_id, user_id, content, created_at, updated_at')
      .single()
    if (data) setComments(prev => prev.map(c => (c.id === id ? data : c)))
    setEditingId(null)
    setEditDraft('')
  }

  async function remove(id: string) {
    setComments(prev => prev.filter(c => c.id !== id))
    await supabase.from('note_comments').delete().eq('id', id)
  }

  function authorName(userId: string) {
    if (userId === currentUserId) return 'You'
    return profiles[userId]?.display_name || 'Member'
  }

  return (
    <div className={s.section} data-print="hide">
      <button className={s.toggle} onClick={() => setOpen(o => !o)}>
        <CommentIcon />
        <span>Comments</span>
        {loaded && <span className={s.count}>{comments.length}</span>}
        <ChevronSmIcon open={open} />
      </button>

      {open && (
        <div className={s.body}>
          {offline ? (
            <p className={s.notice}>Comments are available online. Reconnect to view and post.</p>
          ) : (
            <>
              <div className={s.list}>
                {comments.length === 0 ? (
                  <p className={s.empty}>No comments yet. Start the discussion.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className={s.comment}>
                      <div className={s.commentHead}>
                        <span className={s.author}>{authorName(c.user_id)}</span>
                        <span className={s.time}>{formatRelative(c.created_at)}</span>
                        {c.user_id === currentUserId && editingId !== c.id && (
                          <span className={s.actions}>
                            <button
                              className={s.actionBtn}
                              onClick={() => { setEditingId(c.id); setEditDraft(c.content) }}
                            >
                              Edit
                            </button>
                            <button className={s.actionBtn} onClick={() => remove(c.id)}>
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                      {editingId === c.id ? (
                        <div className={s.editRow}>
                          <textarea
                            className={s.editArea}
                            value={editDraft}
                            onChange={e => setEditDraft(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className={s.editActions}>
                            <button className={s.saveBtn} onClick={() => saveEdit(c.id)}>Save</button>
                            <button
                              className={s.cancelBtn}
                              onClick={() => { setEditingId(null); setEditDraft('') }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={s.content}>{c.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className={s.composer}>
                <textarea
                  className={s.composerArea}
                  placeholder="Write a comment…"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void post() }
                  }}
                  rows={2}
                />
                <button className={s.postBtn} onClick={() => void post()} disabled={posting || !draft.trim()}>
                  {posting ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ChevronSmIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={s.chevron}
      data-open={open}
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
