'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { TaskDetailPanel } from './TaskDetailPanel'
import { KanbanBoard } from './KanbanBoard'
import s from './TasksView.module.css'

type List = { id: string; title: string; color: string | null } | null
type Task = { id: string; title: string; notes: string | null; priority: number; due_date: string | null; completed_at: string | null; sort_order: number; parent_id: string | null; status: string; assigned_to: string | null }
type Member = { userId: string; displayName: string | null }

const PRIORITY_COLOR = ['', '#7b82a8', '#6c63ff', '#f5a623', '#e05c5c']
const PRIORITY_LABEL = ['', 'low', 'medium', 'high', 'urgent']

export function TasksView({ list, tasks: initial, members = [], currentUserId }: {
  list: List
  tasks: Task[]
  members?: Member[]
  currentUserId?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [filterAssigned, setFilterAssigned] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  function toggleBulk(id: string) {
    setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function exitBulk() { setBulkMode(false); setBulkSelected(new Set()) }

  async function bulkDelete() {
    const ids = Array.from(bulkSelected)
    await supabase.from('tasks').delete().in('id', ids)
    setTasks(prev => prev.filter(t => !bulkSelected.has(t.id)))
    exitBulk()
  }

  async function bulkComplete() {
    const ids = Array.from(bulkSelected)
    const now = new Date().toISOString()
    await supabase.from('tasks').update({ completed_at: now }).in('id', ids)
    setTasks(prev => prev.map(t => bulkSelected.has(t.id) ? { ...t, completed_at: now } : t))
    exitBulk()
  }

  const visibleTasks = filterAssigned && currentUserId
    ? tasks.filter(t => t.assigned_to === currentUserId)
    : tasks
  const open = visibleTasks.filter(t => !t.completed_at).sort((a, b) => a.sort_order - b.sort_order)
  const done = visibleTasks.filter(t => !!t.completed_at)
  const selectedTask = tasks.find(t => t.id === selected) ?? null

  async function addTask() {
    if (!newTitle.trim() || !list) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('tasks')
      .insert({ title: newTitle.trim(), list_id: list.id, sort_order: open.length, status: 'todo' })
      .select('id, title, notes, priority, due_date, completed_at, sort_order, parent_id, status, assigned_to')
      .single()
    if (data) {
      setTasks(prev => [...prev, { ...data, status: data.status ?? 'todo', assigned_to: data.assigned_to ?? null }])
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !list) return

    const oldIndex = open.findIndex(t => t.id === active.id)
    const newIndex = open.findIndex(t => t.id === over.id)
    const reordered = arrayMove(open, oldIndex, newIndex)

    setTasks(prev => {
      const doneItems = prev.filter(t => !!t.completed_at)
      return [...reordered.map((t, i) => ({ ...t, sort_order: i })), ...doneItems]
    })

    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }))
    await supabase.rpc('reorder_tasks', { p_list_id: list.id, updates })
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
          {bulkMode ? (
            <>
              <span className={s.bulkCount}>{bulkSelected.size} selected</span>
              <button className={s.bulkBtn} onClick={bulkComplete} disabled={bulkSelected.size === 0}>Complete</button>
              <button className={`${s.bulkBtn} ${s.bulkDanger}`} onClick={bulkDelete} disabled={bulkSelected.size === 0}>Delete</button>
              <button className={s.bulkCancelBtn} onClick={exitBulk}>Cancel</button>
            </>
          ) : (
            <>
              {currentUserId && members.length > 0 && (
                <button
                  className={`${s.bulkCancelBtn} ${filterAssigned ? s.filterActive : ''}`}
                  onClick={() => setFilterAssigned(f => !f)}
                  title="Show only tasks assigned to me"
                >
                  Assigned to me
                </button>
              )}
              <div className={s.viewToggle}>
                <button className={`${s.viewBtn} ${viewMode === 'list' ? s.viewBtnActive : ''}`} onClick={() => setViewMode('list')} title="List view"><ListIcon /></button>
                <button className={`${s.viewBtn} ${viewMode === 'board' ? s.viewBtnActive : ''}`} onClick={() => setViewMode('board')} title="Board view"><BoardIcon /></button>
              </div>
              <button className={s.bulkCancelBtn} onClick={() => setBulkMode(true)}>Select</button>
              <ExportMenu tasks={tasks} listTitle={list.title} />
            </>
          )}
        </div>

        {viewMode === 'board' ? (
          <KanbanBoard
            tasks={visibleTasks.filter(t => !t.parent_id)}
            members={members}
            onSelect={setSelected}
          />
        ) : (
        <>
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

        {mounted && !bulkMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={open.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className={s.taskList}>
                {open.map(task => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    active={selected === task.id}
                    onToggle={toggleTask}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className={s.taskList}>
            {open.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                active={selected === task.id}
                onToggle={toggleTask}
                onSelect={bulkMode ? toggleBulk : setSelected}
                bulkMode={bulkMode}
                bulkSelected={bulkSelected.has(task.id)}
              />
            ))}
          </div>
        )}

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
                onSelect={bulkMode ? toggleBulk : setSelected}
                dimmed
                bulkMode={bulkMode}
                bulkSelected={bulkSelected.has(task.id)}
              />
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          listId={list.id}
          members={members}
          onClose={() => setSelected(null)}
          onUpdate={patch => {
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...patch } : t))
          }}
        />
      )}
    </div>
  )
}

function SortableTaskRow({ task, active, onToggle, onSelect }: {
  task: Task
  active: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={`${s.row} ${active ? s.rowActive : ''}`}>
      <span className={s.dragHandle} {...attributes} {...listeners} title="Drag to reorder">
        <GripIcon />
      </span>
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

function TaskRow({ task, active, onToggle, onSelect, dimmed, bulkMode = false, bulkSelected = false }: {
  task: Task
  active: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  dimmed?: boolean
  bulkMode?: boolean
  bulkSelected?: boolean
}) {
  return (
    <div className={`${s.row} ${active ? s.rowActive : ''} ${dimmed ? s.rowDimmed : ''} ${bulkSelected ? s.rowBulkSelected : ''}`}
      onClick={bulkMode ? () => onSelect(task.id) : undefined}
    >
      {bulkMode ? (
        <div className={`${s.bulkCheck} ${bulkSelected ? s.bulkCheckActive : ''}`}>
          {bulkSelected ? '✓' : ''}
        </div>
      ) : (
        <button
          className={`${s.check} ${task.completed_at ? s.checked : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(task.id) }}
          aria-label="Complete"
        >
          {task.completed_at && <CheckIcon />}
        </button>
      )}
      <div className={s.rowBody} onClick={bulkMode ? undefined : () => onSelect(task.id)}>
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

function ExportMenu({ tasks, listTitle }: { tasks: Task[]; listTitle: string }) {
  const [open, setOpen] = useState(false)

  function exportMarkdown() {
    const lines = [`# ${listTitle}`, '']
    const openTasks = tasks.filter(t => !t.completed_at).sort((a, b) => a.sort_order - b.sort_order)
    const doneTasks = tasks.filter(t => !!t.completed_at)
    for (const t of openTasks) lines.push(`- [ ] ${t.title}`)
    if (doneTasks.length > 0) {
      lines.push('', '## Completed', '')
      for (const t of doneTasks) lines.push(`- [x] ${t.title}`)
    }
    download(`${listTitle}.md`, lines.join('\n'), 'text/markdown')
    setOpen(false)
  }

  function exportCsv() {
    const rows = [['Title', 'Status', 'Priority', 'Due Date']]
    for (const t of tasks) {
      rows.push([
        t.title,
        t.completed_at ? 'Done' : 'Open',
        ['', 'Low', 'Medium', 'High', 'Urgent'][t.priority] ?? '',
        t.due_date ?? '',
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    download(`${listTitle}.csv`, csv, 'text/csv')
    setOpen(false)
  }

  return (
    <div className={s.exportWrap}>
      <button className={s.exportBtn} onClick={() => setOpen(v => !v)} title="Export list">
        <ExportIcon />
      </button>
      {open && (
        <>
          <div className={s.exportOverlay} onClick={() => setOpen(false)} />
          <div className={s.exportMenu}>
            <button className={s.exportItem} onClick={exportMarkdown}>Export as Markdown</button>
            <button className={s.exportItem} onClick={exportCsv}>Export as CSV</button>
          </div>
        </>
      )}
    </div>
  )
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
function GripIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg> }
function ExportIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function ListIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }
function BoardIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="15" rx="1"/></svg> }
