'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import s from './DashboardView.module.css'

type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; updated_at: string; note_tags: NoteTag[] }
type TodoList = { title: string; color: string | null } | null
type Task = { id: string; title: string; priority: number; due_date: string | null; completed_at: string | null; list_id: string; todo_lists: TodoList }

const PRIORITY_LABEL = ['', 'low', 'medium', 'high', 'urgent']
const PRIORITY_COLOR = ['', '#7b82a8', '#6c63ff', '#f5a623', '#e05c5c']

export function DashboardView({ notes, tasks, userId }: { notes: Note[]; tasks: Task[]; userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [done, setDone] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().slice(0, 10)
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const todayTasks = tasks.filter(t => t.due_date === today && !done.has(t.id))
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && !done.has(t.id))

  async function toggleTask(id: string) {
    setDone(prev => new Set([...prev, id]))
    await supabase.rpc('toggle_task_complete', { task_id: id })
    router.refresh()
  }

  return (
    <div className={s.root}>
      <div className={s.hello}>
        <h1 className={s.h1}>Today</h1>
        <span className={s.date}>{todayLabel}</span>
      </div>

      {notes.length > 0 && (
        <section>
          <div className={s.sectionHead}>
            <div className={s.h2}>Pinned notes</div>
            <span className={s.countMuted}>{notes.length} pinned</span>
          </div>
          <div className={s.noteGrid}>
            {notes.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        </section>
      )}

      <section>
        <div className={s.sectionHead}>
          <div className={s.h2}>Today&apos;s tasks</div>
          <span className={s.countMuted}>{todayTasks.length} due today</span>
        </div>
        <div className={s.taskCard}>
          <div className={s.taskListHead}>Today · {todayTasks.length}</div>
          {todayTasks.length === 0 ? (
            <div className={s.emptyHint}>Nothing due today. Enjoy a calm afternoon.</div>
          ) : todayTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask} />)}
        </div>
      </section>

      {overdueTasks.length > 0 && (
        <section>
          <div className={s.sectionHead}>
            <div className={s.h2}>Overdue</div>
            <span className={`${s.countMuted} ${s.danger}`}>{overdueTasks.length} late</span>
          </div>
          <div className={s.taskCard}>
            <div className={`${s.taskListHead} ${s.overdueHead}`}>Overdue · {overdueTasks.length}</div>
            {overdueTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function NoteCard({ note }: { note: Note }) {
  const snippet = note.content?.replace(/[#*_`]/g, '').slice(0, 120) ?? ''
  const tags = note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? []
  return (
    <Link href={`/notes/${note.id}`} style={{ textDecoration: 'none' }}>
      <div
        className={s.noteCard}
        style={note.color ? { borderTopColor: note.color, borderTopWidth: 3 } : undefined}
      >
        {note.title && <div className={s.noteTitle}>{note.title}</div>}
        {snippet && <div className={s.noteSnippet}>{snippet}</div>}
        {tags.length > 0 && (
          <div className={s.noteTags}>
            {tags.slice(0, 3).map(tag => (
              <span key={tag.id} className={s.tag} style={tag.color ? { color: tag.color } : undefined}>
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const p = task.priority ?? 0
  return (
    <div className={s.taskRow}>
      <button className={s.checkbox} onClick={() => onToggle(task.id)} aria-label="Complete task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <div className={s.taskInfo}>
        <Link href={`/lists/${task.list_id}`} className={s.taskTitle}>{task.title}</Link>
        {task.todo_lists && (
          <span className={s.taskList} style={{ color: task.todo_lists.color ?? undefined }}>
            {task.todo_lists.title}
          </span>
        )}
      </div>
      {p > 0 && (
        <span className={s.priority} style={{ color: PRIORITY_COLOR[p] }}>
          {PRIORITY_LABEL[p]}
        </span>
      )}
    </div>
  )
}
