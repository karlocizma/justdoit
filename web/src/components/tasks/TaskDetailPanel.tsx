'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateTask, createTask, toggleTask } from '@/lib/offline'
import type { Database } from '@/lib/database.types'
import s from './TaskDetailPanel.module.css'

type TaskUpdate = Database['public']['Tables']['tasks']['Update']

type Task = { id: string; title: string; notes: string | null; priority: number; due_date: string | null; completed_at: string | null; sort_order: number; parent_id: string | null; status: string; assigned_to: string | null }
type SubTask = { id: string; title: string; completed_at: string | null }
type Member = { userId: string; displayName: string | null }

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const PRIORITIES = [
  { value: 0, label: 'none' },
  { value: 1, label: 'low' },
  { value: 2, label: 'medium' },
  { value: 3, label: 'high' },
  { value: 4, label: 'urgent' },
]
const PRIORITY_COLOR = ['var(--jd-fg-dim)', '#7b82a8', '#6c63ff', '#f5a623', '#e05c5c']

export function TaskDetailPanel({ task, listId, members = [], onClose }: {
  task: Task
  listId: string
  members?: Member[]
  onClose: () => void
}) {
  const supabase = createClient()
  const [notes, setNotes] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [status, setStatus] = useState(task.status ?? 'todo')
  const [assignedTo, setAssignedTo] = useState<string | null>(task.assigned_to)
  const [subTasks, setSubTasks] = useState<SubTask[]>([])
  const [subInput, setSubInput] = useState('')
  const [subLoaded, setSubLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadSubTasks() {
    if (subLoaded) return
    const { data } = await supabase
      .from('tasks')
      .select('id, title, completed_at')
      .eq('parent_id', task.id)
      .order('sort_order')
    setSubTasks(data ?? [])
    setSubLoaded(true)
  }

  async function save(patch: TaskUpdate & { status?: string; assigned_to?: string | null }) {
    setSaving(true)
    await updateTask(task.id, patch)
    setSaving(false)
  }

  async function addSubTask() {
    if (!subInput.trim()) return
    const created = await createTask({ title: subInput.trim(), parent_id: task.id, list_id: listId, sort_order: subTasks.length })
    setSubTasks(prev => [...prev, { id: created.id, title: created.title, completed_at: null }])
    setSubInput('')
  }

  async function toggleSub(id: string) {
    const sub = subTasks.find(s => s.id === id)
    await toggleTask(id, { completed_at: sub?.completed_at ?? null })
    setSubTasks(prev => prev.map(s =>
      s.id === id ? { ...s, completed_at: s.completed_at ? null : new Date().toISOString() } : s
    ))
  }

  return (
    <div className={s.panel}>
      <div className={s.inner}>
        <div className={s.panelHeader}>
          <span className={s.panelTitle}>Task details</span>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={s.taskTitle}>{task.title}</div>

        <div className={s.fieldGroup}>
          <label className={s.label}>Priority</label>
          <div className={s.priorityRow}>
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                className={`${s.priorityBtn} ${priority === p.value ? s.priorityActive : ''}`}
                style={priority === p.value ? { borderColor: PRIORITY_COLOR[p.value], color: PRIORITY_COLOR[p.value] } : undefined}
                onClick={async () => { setPriority(p.value); await save({ priority: p.value }) }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>Status</label>
          <div className={s.statusRow}>
            {STATUSES.map(st => (
              <button
                key={st.value}
                className={`${s.statusBtn} ${status === st.value ? s.statusActive : ''}`}
                onClick={async () => { setStatus(st.value); await save({ status: st.value }) }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {members.length > 0 && (
          <div className={s.fieldGroup}>
            <label className={s.label}>Assigned to</label>
            <div className={s.assigneeRow}>
              <button
                className={`${s.assigneeBtn} ${!assignedTo ? s.assigneeBtnActive : ''}`}
                onClick={async () => { setAssignedTo(null); await save({ assigned_to: null }) }}
              >
                Unassigned
              </button>
              {members.map(m => {
                const initials = m.displayName ? m.displayName.slice(0, 2).toUpperCase() : '?'
                return (
                  <button
                    key={m.userId}
                    className={`${s.assigneeBtn} ${assignedTo === m.userId ? s.assigneeBtnActive : ''}`}
                    title={m.displayName ?? m.userId}
                    onClick={async () => { setAssignedTo(m.userId); await save({ assigned_to: m.userId }) }}
                  >
                    <span className={s.assigneeAvatar}>{initials}</span>
                    <span>{m.displayName ?? 'Member'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className={s.fieldGroup}>
          <label className={s.label}>Due date</label>
          <input
            type="date"
            className={s.dateInput}
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            onBlur={() => save({ due_date: dueDate || null })}
          />
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>Notes</label>
          <textarea
            className={s.notesArea}
            placeholder="Add notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => save({ notes: notes || null })}
          />
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label} onClick={loadSubTasks} style={{ cursor: 'pointer' }}>
            Sub-tasks
            {subTasks.length > 0 && (
              <span className={s.subCount}>{subTasks.filter(s => !s.completed_at).length}/{subTasks.length}</span>
            )}
          </label>
          {!subLoaded && (
            <button className={s.loadSubBtn} onClick={loadSubTasks}>Load sub-tasks</button>
          )}
          {subLoaded && (
            <>
              {subTasks.map(sub => (
                <div key={sub.id} className={s.subRow}>
                  <button
                    className={`${s.subCheck} ${sub.completed_at ? s.subChecked : ''}`}
                    onClick={() => toggleSub(sub.id)}
                  >
                    {sub.completed_at && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                  <span className={`${s.subTitle} ${sub.completed_at ? s.subDone : ''}`}>{sub.title}</span>
                </div>
              ))}
              <div className={s.subAdd}>
                <input
                  className={s.subInput}
                  placeholder="Add sub-task…"
                  value={subInput}
                  onChange={e => setSubInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubTask()}
                />
              </div>
            </>
          )}
        </div>

        {saving && <div className={s.savingLabel}>Saving…</div>}
      </div>
    </div>
  )
}
