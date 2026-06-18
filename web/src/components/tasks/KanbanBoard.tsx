'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { updateTask } from '@/lib/offline'
import s from './KanbanBoard.module.css'

type Task = {
  id: string
  title: string
  status: string
  priority: number
  due_date: string | null
  assigned_to: string | null
  completed_at: string | null
}
type Member = { userId: string; displayName: string | null }

const COLUMNS: { id: string; label: string }[] = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done',        label: 'Done' },
]

const PRIORITY_COLOR = ['', '#7b82a8', '#6c63ff', '#f5a623', '#e05c5c']

export function KanbanBoard({ tasks: initial, members = [], onSelect }: {
  tasks: Task[]
  members?: Member[]
  onSelect: (id: string) => void
}) {
  const [tasks, setTasks] = useState(initial)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const draggingTask = tasks.find(t => t.id === draggingId)

  function onDragStart(e: DragStartEvent) {
    setDraggingId(e.active.id as string)
  }

  async function onDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = e
    if (!over) return
    const newStatus = over.id as string
    const taskId = active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await updateTask(taskId, { status: newStatus })
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
      <div className={s.board}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasks.filter(t => t.status === col.id)}
            members={members}
            draggingId={draggingId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingTask && <CardView task={draggingTask} members={members} ghost />}
      </DragOverlay>
    </DndContext>
  )
}

function Column({ id, label, tasks, members, draggingId, onSelect }: {
  id: string
  label: string
  tasks: Task[]
  members: Member[]
  draggingId: string | null
  onSelect: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className={`${s.column} ${isOver ? s.columnOver : ''}`} ref={setNodeRef}>
      <div className={s.colHeader}>
        <span className={s.colLabel}>{label}</span>
        <span className={s.colCount}>{tasks.length}</span>
      </div>
      <div className={s.cards}>
        {tasks.map(task => (
          <DraggableCard
            key={task.id}
            task={task}
            members={members}
            isDragging={draggingId === task.id}
            onSelect={onSelect}
          />
        ))}
        {tasks.length === 0 && <div className={s.empty}>Drop here</div>}
      </div>
    </div>
  )
}

function DraggableCard({ task, members, isDragging, onSelect }: {
  task: Task
  members: Member[]
  isDragging: boolean
  onSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${s.cardOuter} ${isDragging ? s.cardGhost : ''}`}
      {...attributes}
    >
      <div className={s.dragHandle} {...listeners}>
        <GripIcon />
      </div>
      <CardView task={task} members={members} onClick={() => onSelect(task.id)} />
    </div>
  )
}

function CardView({ task, members, onClick, ghost }: {
  task: Task
  members: Member[]
  onClick?: () => void
  ghost?: boolean
}) {
  const assignee = members.find(m => m.userId === task.assigned_to)
  const initials = assignee?.displayName
    ? assignee.displayName.slice(0, 2).toUpperCase()
    : task.assigned_to ? '?' : null

  return (
    <div className={`${s.card} ${ghost ? s.cardGhostOverlay : ''}`} onClick={onClick}>
      <div className={s.cardTitle}>{task.title}</div>
      <div className={s.cardMeta}>
        {task.priority > 0 && (
          <span className={s.cardPriority} style={{ background: PRIORITY_COLOR[task.priority] + '22', color: PRIORITY_COLOR[task.priority] }}>
            {'!'.repeat(task.priority)}
          </span>
        )}
        {task.due_date && <span className={s.cardDue}>{formatDue(task.due_date)}</span>}
        {initials && <span className={s.cardAssignee} title={assignee?.displayName ?? ''}>{initials}</span>}
      </div>
    </div>
  )
}

function formatDue(date: string) {
  const d = new Date(date)
  const diff = Math.floor((d.getTime() - Date.now()) / 86400000)
  if (diff < 0) return <span style={{ color: '#e05c5c' }}>{Math.abs(diff)}d overdue</span>
  if (diff === 0) return <span style={{ color: '#f5a623' }}>Today</span>
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function GripIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/></svg>
}
