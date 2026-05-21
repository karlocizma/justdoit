'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import s from './WorkspaceView.module.css'

type Tag = { id: string; name: string; color: string | null }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; updated_at: string; note_tags: { tags: Tag }[] }
type List = { id: string; title: string; color: string; icon: string | null; task_count: number }
type Member = { userId: string; role: string; displayName: string | null }
type ActivityItem = { id: string; kind: 'note' | 'task'; title: string; updatedAt: string; href: string }

const ROLES = ['member', 'admin', 'owner'] as const

export function WorkspaceView({ workspace, notes: initialNotes, lists: initialLists, members: initialMembers, currentUserId, activity }: {
  workspace: { id: string; name: string }
  notes: Note[]
  lists: List[]
  members: Member[]
  currentUserId: string
  activity: ActivityItem[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [notes, setNotes] = useState(initialNotes)
  const [lists, setLists] = useState(initialLists)
  const [members, setMembers] = useState(initialMembers)
  const [newListTitle, setNewListTitle] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)

  const currentMember = members.find(m => m.userId === currentUserId)
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const isOwner = currentMember?.role === 'owner'

  async function createNote() {
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'Untitled', content: '', workspace_id: workspace.id })
      .select('id')
      .single()
    if (data) router.push(`/notes/${data.id}`)
  }

  async function createList() {
    if (!newListTitle.trim()) return
    setCreatingList(true)
    const { data } = await supabase
      .from('todo_lists')
      .insert({ title: newListTitle.trim(), color: '#6c63ff', workspace_id: workspace.id, sort_order: lists.length })
      .select('id, title, color, icon')
      .single()
    setCreatingList(false)
    if (data) {
      setLists(prev => [...prev, { ...data, color: data.color ?? '#6c63ff', icon: data.icon ?? null, task_count: 0 }])
      setNewListTitle('')
      router.refresh()
    }
  }

  async function changeRole(userId: string, newRole: string) {
    setRoleChanging(userId)
    await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId)
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m))
    setRoleChanging(null)
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId)
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.wsAvatar}>{workspace.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h1 className={s.title}>{workspace.name}</h1>
            <div className={s.memberLine}>
              {members.map(m => (
                <span key={m.userId} className={`${s.memberChip} ${s['role_' + m.role]}`} title={m.role}>
                  {(m.displayName ?? '?').slice(0, 1).toUpperCase()}
                </span>
              ))}
              <span className={s.memberCount}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <Link href="/settings" className={s.manageLink}>Manage workspace</Link>
      </div>

      {/* Activity feed */}
      {activity.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <span className={s.sectionLabel}>Recent activity</span>
          </div>
          <div className={s.activityList}>
            {activity.map(item => (
              <Link key={item.id + item.kind} href={item.href} className={s.activityRow}>
                <span className={s.activityIcon}>{item.kind === 'note' ? '📝' : '✓'}</span>
                <span className={s.activityTitle}>{item.title || 'Untitled'}</span>
                <span className={s.activityTime}>{formatRelative(item.updatedAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <span className={s.sectionLabel}>Notes</span>
          <button className={s.addBtn} onClick={createNote}>+ New note</button>
        </div>
        {notes.length === 0 ? (
          <p className={s.empty}>No notes in this workspace yet.</p>
        ) : (
          <div className={s.noteGrid}>
            {notes.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        )}
      </section>

      {/* Lists */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <span className={s.sectionLabel}>Lists</span>
        </div>
        <div className={s.listGrid}>
          {lists.map(l => (
            <Link key={l.id} href={`/lists/${l.id}`} className={s.listCard}>
              <span className={s.listDot} style={{ background: l.color }} />
              <span className={s.listName}>{l.icon ? `${l.icon} ` : ''}{l.title}</span>
              <span className={s.listCount}>{l.task_count} task{l.task_count !== 1 ? 's' : ''}</span>
            </Link>
          ))}
          <div className={s.newListRow}>
            <input
              className={s.newListInput}
              placeholder="New list name…"
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()}
            />
            <button className={s.addBtn} onClick={createList} disabled={creatingList || !newListTitle.trim()}>
              {creatingList ? '…' : 'Add'}
            </button>
          </div>
        </div>
      </section>

      {/* Members */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <span className={s.sectionLabel}>Members</span>
          {canManage && <Link href="/settings" className={s.manageLink}>Invite member</Link>}
        </div>
        <div className={s.memberList}>
          {members.map(m => {
            const isSelf = m.userId === currentUserId
            const canEdit = isOwner && !isSelf && m.role !== 'owner'
            return (
              <div key={m.userId} className={s.memberRow}>
                <div className={s.memberAvatar}>{(m.displayName ?? '?').slice(0, 1).toUpperCase()}</div>
                <span className={s.memberName}>{m.displayName ?? 'Unknown'}{isSelf && <span className={s.youBadge}> (you)</span>}</span>
                {canEdit ? (
                  <select
                    className={s.roleSelect}
                    value={m.role}
                    disabled={roleChanging === m.userId}
                    onChange={e => changeRole(m.userId, e.target.value)}
                  >
                    {ROLES.filter(r => r !== 'owner').map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`${s.roleChip} ${s['role_' + m.role]}`}>{m.role}</span>
                )}
                {canEdit && (
                  <button className={s.removeBtn} onClick={() => removeMember(m.userId)} title="Remove member">×</button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function NoteCard({ note }: { note: Note }) {
  const snippet = note.content?.replace(/[#*_`[\]]/g, '').trim().slice(0, 120) ?? ''
  const tags = note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? []
  return (
    <Link href={`/notes/${note.id}`} className={s.noteCard}>
      {note.color && <div className={s.noteColorBar} style={{ background: note.color }} />}
      <div className={s.noteBody}>
        <div className={s.noteTitle}>{note.title || 'Untitled'}</div>
        {snippet && <div className={s.noteSnippet}>{snippet}</div>}
        {tags.length > 0 && (
          <div className={s.noteTags}>
            {tags.slice(0, 2).map(t => (
              <span key={t.id} className={s.noteTag}>{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
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
