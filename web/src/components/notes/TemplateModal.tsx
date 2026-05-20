'use client'

import { useState } from 'react'
import s from './TemplateModal.module.css'

export type Template = {
  id: string
  name: string
  description: string
  content: string
}

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Agenda, attendees, action items',
    content: `## Meeting Notes

**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
**Attendees:**

---

## Agenda

1.
2.
3.

---

## Notes


---

## Action Items

- [ ]
- [ ]
`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    description: 'Goal, milestones, risks',
    content: `## Project Plan

**Project:**
**Owner:**
**Target date:**

---

## Goal

> What does success look like?

---

## Milestones

| Milestone | Due | Status |
|---|---|---|
|  |  | Not started |
|  |  | Not started |
|  |  | Not started |

---

## Risks

-

---

## Notes

`,
  },
  {
    id: 'journal',
    name: 'Daily Journal',
    description: 'Reflection, gratitude, tasks',
    content: `## ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

### How I'm feeling


### What I'm grateful for

-
-
-

### Today's focus


### What I accomplished today


### What I'll do differently tomorrow

`,
  },
  {
    id: 'bug',
    name: 'Bug Report',
    description: 'Steps to reproduce, expected vs actual',
    content: `## Bug Report

**Summary:**
**Severity:** Low / Medium / High / Critical
**Environment:**

---

## Steps to Reproduce

1.
2.
3.

## Expected Behavior


## Actual Behavior


## Screenshots / Logs

\`\`\`

\`\`\`

## Possible Fix

`,
  },
  {
    id: 'weekly',
    name: 'Weekly Review',
    description: 'Wins, learnings, next week',
    content: `## Weekly Review — Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

### Wins this week

-
-
-

### What didn't go as planned


### Key learnings


### Next week's priorities

1.
2.
3.

### Anything to let go of?

`,
  },
  {
    id: 'book',
    name: 'Book Notes',
    description: 'Summary, key ideas, quotes',
    content: `## Book Notes

**Title:**
**Author:**
**Started:**
**Finished:**
**Rating:** ★★★★☆

---

## Summary


---

## Key Ideas

1.
2.
3.

---

## Memorable Quotes

>

---

## How I'll apply this

`,
  },
]

export function TemplateModal({
  onSelect,
  onClose,
  hasContent,
}: {
  onSelect: (content: string) => void
  onClose: () => void
  hasContent: boolean
}) {
  const [selected, setSelected] = useState<Template | null>(null)
  const [confirmMode, setConfirmMode] = useState<'replace' | 'append' | null>(null)

  function choose(t: Template) {
    if (hasContent) {
      setSelected(t)
      setConfirmMode('replace')
    } else {
      onSelect(t.content)
      onClose()
    }
  }

  function confirm(mode: 'replace' | 'append') {
    if (!selected) return
    onSelect(mode === 'append' ? `\n\n${selected.content}` : selected.content)
    onClose()
  }

  return (
    <div className={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={s.modal}>
        <div className={s.header}>
          <h2 className={s.title}>Choose a template</h2>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>

        {confirmMode ? (
          <div className={s.confirm}>
            <p className={s.confirmText}>
              Your note already has content. What would you like to do?
            </p>
            <div className={s.confirmBtns}>
              <button className={s.confirmBtn} onClick={() => confirm('replace')}>Replace content</button>
              <button className={s.confirmBtn} onClick={() => confirm('append')}>Append to note</button>
              <button className={s.cancelBtn} onClick={() => { setConfirmMode(null); setSelected(null) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={s.grid}>
            {BUILT_IN_TEMPLATES.map(t => (
              <button key={t.id} className={s.card} onClick={() => choose(t)}>
                <div className={s.cardIcon}>{TEMPLATE_ICONS[t.id] ?? '📝'}</div>
                <div className={s.cardName}>{t.name}</div>
                <div className={s.cardDesc}>{t.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TEMPLATE_ICONS: Record<string, string> = {
  meeting: '🗓️',
  project: '📋',
  journal: '📖',
  bug: '🐛',
  weekly: '📊',
  book: '📚',
}
