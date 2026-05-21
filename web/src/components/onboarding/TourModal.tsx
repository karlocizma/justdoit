'use client'

import { useEffect, useState } from 'react'
import s from './TourModal.module.css'

const STORAGE_KEY = 'jd_tour_done'

const STEPS = [
  {
    gradient: 'linear-gradient(135deg, #6c63ff 0%, #48d1cc 100%)',
    icon: <WelcomeIcon />,
    title: 'Welcome to JustDoIt!',
    body: 'Your notes, tasks, and workspace in one place. This quick tour covers the key features — takes about a minute.',
  },
  {
    gradient: 'linear-gradient(135deg, #4f8ef7 0%, #6c63ff 100%)',
    icon: <NoteIcon />,
    title: 'Markdown Notes',
    body: 'Write notes with full Markdown — headings, code blocks, tables, and more. Use [[Title]] to link notes together and explore connections in the Graph view (/graph).',
  },
  {
    gradient: 'linear-gradient(135deg, #7c4dff 0%, #e040fb 100%)',
    icon: <EditorIcon />,
    title: 'Editor superpowers',
    body: 'Every note keeps version history so you can restore past content. Attach files, toggle Focus mode (F) to hide distractions, and print or export any note.',
  },
  {
    gradient: 'linear-gradient(135deg, #f5a623 0%, #e05c5c 100%)',
    icon: <TaskIcon />,
    title: 'Tasks & Lists',
    body: 'Organize tasks in lists with due dates, priorities, and sub-tasks. Switch between list view and a Kanban board (To Do → In Progress → Done) using the toggle in the header.',
  },
  {
    gradient: 'linear-gradient(135deg, #00bcd4 0%, #2196f3 100%)',
    icon: <WorkspaceIcon />,
    title: 'Shared Workspaces',
    body: 'Create a workspace and invite teammates. Share notes and task lists, assign tasks to members, and see a real-time activity feed — all synced instantly.',
  },
  {
    gradient: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
    icon: <AiIcon />,
    title: 'AI Assistant',
    body: 'Summarize notes, auto-suggest tags, extract a task list from any note, or run a smart natural-language search. Add your Anthropic API key in Settings → AI.',
  },
  {
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    icon: <KeyboardIcon />,
    title: 'Keyboard shortcuts',
    body: '⌘K opens the command palette anywhere. N creates a new note, / opens search, ? shows all shortcuts, F toggles focus mode. You\'ll be fast in no time.',
  },
  {
    gradient: 'linear-gradient(135deg, #6c63ff 0%, #48d1cc 100%)',
    icon: <RocketIcon />,
    title: "You're all set!",
    body: 'Start by creating a note or a task list. Hit the ? button in the top bar to replay this tour anytime, or press ? on your keyboard to see all shortcuts.',
  },
]

export function TourButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  return (
    <>
      <button className={s.triggerBtn} onClick={() => setOpen(true)} title="Product tour" aria-label="Open tour">
        <TourIcon />
      </button>
      {open && <TourModal onClose={handleClose} />}
    </>
  )
}

function TourModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function next() {
    if (isLast) { onClose(); return }
    setStep(s => s + 1)
  }

  function back() { setStep(s => s - 1) }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && !isLast) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step, isLast, onClose])

  return (
    <div className={s.overlay} onClick={handleOverlayClick}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Product tour">
        <div className={s.hero} style={{ background: current.gradient }}>
          <div className={s.heroIcon}>{current.icon}</div>
          <button className={s.closeBtn} onClick={onClose} aria-label="Close tour">×</button>
        </div>

        <div className={s.body}>
          <div className={s.dots}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`${s.dot} ${i === step ? s.dotActive : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <h2 className={s.title}>{current.title}</h2>
          <p className={s.desc}>{current.body}</p>

          <div className={s.footer}>
            <button className={s.skipBtn} onClick={onClose}>Skip tour</button>
            <div className={s.navBtns}>
              {step > 0 && (
                <button className={s.backBtn} onClick={back}>← Back</button>
              )}
              <button className={s.nextBtn} onClick={next}>
                {isLast ? 'Get started' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TourIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function WelcomeIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function EditorIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function WorkspaceIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function AiIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0110 4a2 2 0 012-2z"/>
      <path d="M9 14h.01M15 14h.01M9.5 17.5s1 1 2.5 1 2.5-1 2.5-1"/>
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01"/>
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  )
}
