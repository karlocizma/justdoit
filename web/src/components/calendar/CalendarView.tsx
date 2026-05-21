'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import s from './CalendarView.module.css'

type Task = {
  id: string
  title: string
  priority: number | null
  due_date: string | null
  completed_at: string | null
  list_id: string | null
  todo_lists: { title: string; color: string | null } | null
}
type CalNote = { id: string; title: string; due_at: string | null; color: string | null }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const PRIORITY_COLOR: Record<number, string> = {
  0: 'var(--jd-fg-faint)',
  1: 'var(--jd-accent-2)',
  2: 'var(--jd-warn)',
  3: 'var(--jd-danger)',
  4: 'var(--jd-danger)',
}

export function CalendarView({ tasks: initialTasks, notes: initialNotes }: { tasks: Task[]; notes: CalNote[] }) {
  const today = new Date()
  const supabase = createClient()
  const [tasks, setTasks] = useState(initialTasks)
  const [notes, setNotes] = useState(initialNotes)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(today.toISOString().slice(0, 10))
  const [view, setView] = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  const [mounted, setMounted] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const todayIso = today.toISOString().slice(0, 10)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  function prevWeek() { setWeekStart(d => addDays(d, -7)) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)) }
  function goToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth())
    setSelectedDay(todayIso); setWeekStart(getWeekStart(today))
  }

  // Group tasks and notes by their date key
  const { tasksByDay, notesByDay } = useMemo(() => {
    const tasksByDay: Record<string, Task[]> = {}
    for (const t of tasks) {
      if (!t.due_date) continue
      if (!tasksByDay[t.due_date]) tasksByDay[t.due_date] = []
      tasksByDay[t.due_date].push(t)
    }
    const notesByDay: Record<string, CalNote[]> = {}
    for (const n of notes) {
      if (!n.due_at) continue
      const day = n.due_at.slice(0, 10)
      if (!notesByDay[day]) notesByDay[day] = []
      notesByDay[day].push(n)
    }
    return { tasksByDay, notesByDay }
  }, [tasks, notes])

  // Month grid cells
  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }, [year, month])

  // Week view days (7 days from weekStart)
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i))), [weekStart])

  const selectedTasks = selectedDay ? (tasksByDay[selectedDay] ?? []) : []
  const selectedNotes = selectedDay ? (notesByDay[selectedDay] ?? []) : []

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const s1 = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const s2 = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${s1} – ${s2}`
  }, [weekStart])

  // DnD active item
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const [type, id] = activeId.split(':')
    if (type === 'task') return tasks.find(t => t.id === id) ?? null
    if (type === 'note') return notes.find(n => n.id === id) ?? null
    return null
  }, [activeId, tasks, notes])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const [type, id] = (active.id as string).split(':')
    const newDate = over.id as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return

    if (type === 'task') {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: newDate } : t))
      await supabase.from('tasks').update({ due_date: newDate }).eq('id', id)
    } else if (type === 'note') {
      const existing = notes.find(n => n.id === id)
      if (!existing) return
      const newIso = existing.due_at
        ? new Date(newDate + 'T' + (existing.due_at.slice(11, 16) || '00:00')).toISOString()
        : new Date(newDate).toISOString()
      setNotes(prev => prev.map(n => n.id === id ? { ...n, due_at: newIso } : n))
      await supabase.from('notes').update({ due_at: newIso }).eq('id', id)
    }
  }

  const calendarBody = (
    <div className={s.body}>
      {view === 'month' ? (
        <div className={s.calendar}>
          <div className={s.grid}>
            {DAYS.map(d => <div key={d} className={s.dayHeader}>{d}</div>)}
            {monthCells.map((iso, i) => {
              if (!iso) return <div key={`empty-${i}`} className={s.emptyCell} />
              const dayTasks = tasksByDay[iso] ?? []
              const dayNotes = notesByDay[iso] ?? []
              const isToday = iso === todayIso
              const isSelected = iso === selectedDay
              const overdue = iso < todayIso

              return (
                <DroppableDay key={iso} id={iso} isOver={false}>
                  <button
                    className={`${s.dayCell} ${isToday ? s.today : ''} ${isSelected ? s.selected : ''}`}
                    onClick={() => setSelectedDay(iso)}
                  >
                    <span className={`${s.dayNum} ${overdue && dayTasks.some(t => !t.completed_at) ? s.overdue : ''}`}>
                      {parseInt(iso.slice(8))}
                    </span>
                    {(dayTasks.length > 0 || dayNotes.length > 0) && (
                      <div className={s.dots}>
                        {dayTasks.slice(0, 3).map(t => (
                          <span key={t.id} className={`${s.dot} ${t.completed_at ? s.dotDone : ''}`}
                            style={{ background: t.completed_at ? undefined : PRIORITY_COLOR[t.priority ?? 0] }} />
                        ))}
                        {dayNotes.slice(0, 2).map(n => (
                          <span key={n.id} className={s.noteDot} style={{ background: n.color ?? 'var(--jd-accent-2)' }} />
                        ))}
                        {(dayTasks.length + dayNotes.length) > 5 && (
                          <span className={s.dotMore}>+{dayTasks.length + dayNotes.length - 5}</span>
                        )}
                      </div>
                    )}
                  </button>
                </DroppableDay>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={s.weekGrid}>
          {weekDays.map(iso => {
            const dayTasks = tasksByDay[iso] ?? []
            const dayNotes = notesByDay[iso] ?? []
            const isToday = iso === todayIso
            const isSelected = iso === selectedDay
            const d = new Date(iso + 'T12:00:00')
            return (
              <DroppableDay key={iso} id={iso} isOver={false}>
                <div
                  className={`${s.weekCol} ${isToday ? s.weekColToday : ''} ${isSelected ? s.weekColSelected : ''}`}
                  onClick={() => setSelectedDay(iso)}
                >
                  <div className={s.weekColHeader}>
                    <span className={s.weekDayName}>{DAYS[d.getDay()]}</span>
                    <span className={`${s.weekDayNum} ${isToday ? s.weekDayNumToday : ''}`}>{d.getDate()}</span>
                  </div>
                  <div className={s.weekItems}>
                    {dayTasks.map(t => (
                      <DraggableItem key={t.id} id={`task:${t.id}`}>
                        <div className={`${s.weekItem} ${t.completed_at ? s.weekItemDone : ''}`}
                          style={{ borderLeftColor: PRIORITY_COLOR[t.priority ?? 0] }}>
                          {t.title}
                        </div>
                      </DraggableItem>
                    ))}
                    {dayNotes.map(n => (
                      <DraggableItem key={n.id} id={`note:${n.id}`}>
                        <Link href={`/notes/${n.id}`} className={s.weekItem} onClick={e => e.stopPropagation()}
                          style={{ borderLeftColor: n.color ?? 'var(--jd-accent)' }}>
                          📝 {n.title || 'Untitled'}
                        </Link>
                      </DraggableItem>
                    ))}
                  </div>
                </div>
              </DroppableDay>
            )
          })}
        </div>
      )}

      {/* Side panel (month view only) */}
      {view === 'month' && (
        <div className={s.panel}>
          {selectedDay ? (
            <>
              <div className={s.panelHeader}>
                <span className={s.panelDate}>
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                {selectedDay === todayIso && <span className={s.todayChip}>Today</span>}
              </div>
              {selectedTasks.length === 0 && selectedNotes.length === 0 ? (
                <p className={s.empty}>No items due this day.</p>
              ) : (
                <div className={s.taskList}>
                  {selectedTasks.map(t => (
                    <DraggableItem key={t.id} id={`task:${t.id}`}>
                      <div className={`${s.taskRow} ${t.completed_at ? s.taskDone : ''}`}>
                        <span className={s.taskDot} style={{ background: PRIORITY_COLOR[t.priority ?? 0] }} />
                        <div className={s.taskInfo}>
                          <div className={s.taskTitle}>{t.title}</div>
                          {t.todo_lists && (
                            <Link href={`/lists/${t.list_id}`} className={s.taskList_}>
                              <span className={s.listDot} style={{ background: t.todo_lists.color ?? '#6c63ff' }} />
                              {t.todo_lists.title}
                            </Link>
                          )}
                        </div>
                        {t.completed_at && <span className={s.doneLabel}>Done</span>}
                      </div>
                    </DraggableItem>
                  ))}
                  {selectedNotes.map(n => (
                    <DraggableItem key={n.id} id={`note:${n.id}`}>
                      <Link href={`/notes/${n.id}`} className={s.taskRow}>
                        <span className={s.notePanelDot} style={{ background: n.color ?? 'var(--jd-accent)' }}>📝</span>
                        <div className={s.taskInfo}>
                          <div className={s.taskTitle}>{n.title || 'Untitled'}</div>
                          <span className={s.taskList_}>Note</span>
                        </div>
                      </Link>
                    </DraggableItem>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className={s.empty}>Select a day to see items.</p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.viewToggle}>
          <button className={`${s.viewBtn} ${view === 'month' ? s.viewBtnActive : ''}`} onClick={() => setView('month')}>Month</button>
          <button className={`${s.viewBtn} ${view === 'week' ? s.viewBtnActive : ''}`} onClick={() => setView('week')}>Week</button>
        </div>
        <button className={s.navBtn} onClick={view === 'month' ? prevMonth : prevWeek}><ChevronLeftIcon /></button>
        <h1 className={s.title}>{view === 'month' ? `${MONTHS[month]} ${year}` : weekLabel}</h1>
        <button className={s.navBtn} onClick={view === 'month' ? nextMonth : nextWeek}><ChevronRightIcon /></button>
        <button className={s.todayBtn} onClick={goToday}>Today</button>
      </div>

      {mounted ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {calendarBody}
          <DragOverlay>
            {activeId && activeItem && (
              <div className={s.dragOverlayItem}>
                {'due_date' in activeItem ? activeItem.title : `📝 ${(activeItem as CalNote).title || 'Untitled'}`}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : calendarBody}
    </div>
  )
}

function DroppableDay({ id, children, isOver: _isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={isOver ? s.dropTarget : undefined} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

function DraggableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      {...attributes} {...listeners}>
      {children}
    </div>
  )
}

function getWeekStart(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay())
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ChevronLeftIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function ChevronRightIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }
