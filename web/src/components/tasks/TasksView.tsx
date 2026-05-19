'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TaskDetailPanel } from './TaskDetailPanel'
import s from './TasksView.module.css'

type List = { id: string; title: string; color: string | null } | null
type Task = { id: string; title: string; notes: string | null; priority: number; due_date: string | null; completed_at: string | null; sort_order: number; parent_id: string | null }

const PRIORITY_COLOR = ['', '#7b82a8', '#6c63ff', '#f5a623', '#e05c5c']
const PRIORITY_LABEL = ['', 'low', 'medium', 'high', 'urgent']

export function TasksView({ list, tasks: initial }: { list: List; tasks: Task[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [listTitle, setListTitle] = useState('')

  const open = tasks.filter(t => !t.completed_at)
  const done = tasks.filter(t => !!t.completed_at)
  const selectedTask = tasks.find(t => t.id === selected) ?? null

  async function addTask() {
    if (!newTitle.trim() || !list) return
    const { data } = await supabase
      .from('tasks')
      .insert({ title: newTitle.trim(), list_id: list.id, sort_order: open.length })
      .select('id, title, notes, priority, due_date, completed_at, sort_order, parent_id')
      .single()
    if (data) {
      setTasks(prev => [...prev, data])
      setNewTitle('')
    }
  }

  async function toggleTask(id: string) {
    await supabase.rpc('toggle_task_complete', { task_id: id })
    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, completed_at: t.completed_at ? null : new Date().toISOString() }
        : t
    ))
  }

  async function createList() {
    if (!listTitle.trim()) return
    const { data } = await supabase
      .from('todo_lists')
      .insert({ title: listTitle.trim(), color: '#6c63ff' })
      .select('id')
      .single()
    if (data) {
      router.push(`/lists/${data.id}`)
      router.refresh()
    }
  }

  if (!list) {
    return (
      <div className={s.root}>
        <div className={s.header}>
          <input
            className={s.listTitleInput}
            placeholder="List name…"
            value={listTitle}
            onChange={e => setListTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()}
            autoFocus
          />
          <button className={s.createBtn} onClick={createList} disabled={!listTitle.trim()}>
            Create list
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={s.layout}>
      <div className={s.root}>
        <div className={s.header}>
          <div className={s.listDot} style={{ background: list.color ?? '#6c63ff' }} />
          <h1 className={s.listTitle}>{list.title}</h1>
          <span className={s.count}>{open.length} open</span>
        </div>

        <div className={s.addRow}>
          <input
            className={s.addInput}
            placeholder="Add a task…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
          />
          <button className={s.addBtn} onClick={addTask} disabled={!newTitle.trim()}>Add</button>
        </div>

        <div className={s.taskList}>
          {open.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              active={selected === task.id}
              onToggle={toggleTask}
              onSelect={setSelected}
            />
          ))}
        </div>

        {done.length > 0 && (
          <div className={s.doneSection}>
            <button className={s.doneToggle} onClick={() => setShowDone(v => !v)}>
              <ChevronIcon open={showDone} /> Completed ({done.length})
            </button>
            {showDone && done.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                active={selected === task.id}
                onToggle={toggleTask}
                onSelect={setSelected}
                dimmed
              />
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          listId={list.id}
          onClose={() => setSelected(null)}
          onUpdate={patch => {
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...patch } : t))
          }}
        />
      )}
    </div>
  )
}

function TaskRow({ task, active, onToggle, onSelect, dimmed }: {
  task: Task
  active: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  dimmed?: boolean
}) {
  return (
    <div className={`${s.row} ${active ? s.rowActive : ''} ${dimmed ? s.rowDimmed : ''}`}>
      <button
        className={`${s.check} ${task.completed_at ? s.checked : ''}`}
        onClick={e => { e.stopPropagation(); onToggle(task.id) }}
        aria-label="Complete"
      >
        {task.completed_at && <CheckIcon />}
      </button>
      <div className={s.rowBody} onClick={() => onSelect(task.id)}>
        <span className={s.rowTitle}>{task.title}</span>
        <div className={s.rowMeta}>
          {task.due_date && <span className={s.due}>{formatDue(task.due_date)}</span>}
          {task.priority > 0 && (
            <span className={s.priority} style={{ color: PRIORITY_COLOR[task.priority] }}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDue(iso: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return 'Today'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CheckIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> }
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
