'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// 0=none, 1=low, 2=medium, 3=high, 4=critical
const PRIORITY_COLOR: Record<number, string> = {
  0: 'var(--jd-fg-faint)',
  1: 'var(--jd-accent-2)',
  2: 'var(--jd-warn)',
  3: 'var(--jd-danger)',
  4: 'var(--jd-danger)',
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(today.toISOString().slice(0, 10))

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build the day grid for this month
  const { cells, tasksByDay } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const tasksByDay: Record<string, Task[]> = {}
    for (const t of tasks) {
      if (!t.due_date) continue
      if (!tasksByDay[t.due_date]) tasksByDay[t.due_date] = []
      tasksByDay[t.due_date].push(t)
    }

    const cells: (string | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push(iso)
    }
    return { cells, tasksByDay }
  }, [year, month, tasks])

  const selectedTasks = selectedDay ? (tasksByDay[selectedDay] ?? []) : []
  const todayIso = today.toISOString().slice(0, 10)

  return (
    <div className={s.root}>
      <div className={s.header}>
        <button className={s.navBtn} onClick={prevMonth}><ChevronLeftIcon /></button>
        <h1 className={s.title}>{MONTHS[month]} {year}</h1>
        <button className={s.navBtn} onClick={nextMonth}><ChevronRightIcon /></button>
        <button className={s.todayBtn} onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayIso) }}>
          Today
        </button>
      </div>

      <div className={s.body}>
        <div className={s.calendar}>
          {/* Day-of-week headers */}
          <div className={s.grid}>
            {DAYS.map(d => (
              <div key={d} className={s.dayHeader}>{d}</div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`empty-${i}`} className={s.emptyCell} />
              const dayTasks = tasksByDay[iso] ?? []
              const isToday = iso === todayIso
              const isSelected = iso === selectedDay
              const overdue = iso < todayIso
              return (
                <button
                  key={iso}
                  className={`${s.dayCell} ${isToday ? s.today : ''} ${isSelected ? s.selected : ''}`}
                  onClick={() => setSelectedDay(iso)}
                >
                  <span className={`${s.dayNum} ${overdue && dayTasks.some(t => !t.completed_at) ? s.overdue : ''}`}>
                    {parseInt(iso.slice(8))}
                  </span>
                  {dayTasks.length > 0 && (
                    <div className={s.dots}>
                      {dayTasks.slice(0, 4).map(t => (
                        <span
                          key={t.id}
                          className={`${s.dot} ${t.completed_at ? s.dotDone : ''}`}
                          style={{ background: t.completed_at ? undefined : PRIORITY_COLOR[t.priority ?? 0] }}
                        />
                      ))}
                      {dayTasks.length > 4 && <span className={s.dotMore}>+{dayTasks.length - 4}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className={s.panel}>
          {selectedDay ? (
            <>
              <div className={s.panelHeader}>
                <span className={s.panelDate}>
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                {selectedDay === todayIso && <span className={s.todayChip}>Today</span>}
              </div>
              {selectedTasks.length === 0 ? (
                <p className={s.empty}>No tasks due this day.</p>
              ) : (
                <div className={s.taskList}>
                  {selectedTasks.map(t => (
                    <div key={t.id} className={`${s.taskRow} ${t.completed_at ? s.taskDone : ''}`}>
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
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className={s.empty}>Select a day to see tasks.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ChevronLeftIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function ChevronRightIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }
