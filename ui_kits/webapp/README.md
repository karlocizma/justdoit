# JustDoIt — Web App UI Kit

A high-fidelity recreation of the JustDoIt productivity web app, built strictly against `design-brief.md`. There is no production frontend repo to copy from — these components are the canonical visual reference.

## How to use

Open `index.html` directly (no build step) — it's a click-thru prototype that lets you sign in, browse the dashboard, open notes, and complete tasks. State is in-memory only; everything resets on refresh.

```
.
├── index.html       — entry; loads React + Babel + every component
├── App.jsx          — top-level shell, view router, mock state
├── Icons.jsx        — Lucide SVG components (no CDN dependency)
├── Sidebar.jsx      — workspace switcher + nav rail
├── TopBar.jsx       — search, sync dot, avatar
├── Dashboard.jsx    — Today view (pinned notes + tasks + overdue)
├── NotesView.jsx    — note grid
├── NoteCard.jsx     — single note card (used in dashboard + notes grid)
├── TasksView.jsx    — to-do list view
├── TaskRow.jsx      — single task row
├── TaskDetailPanel.jsx — slide-in panel
└── AuthCard.jsx     — login / register card
```

## What's covered

- Auth → app flow (login lands you on Dashboard)
- Sidebar nav with workspace switcher
- ⌘K search (visible, not wired)
- Note cards with color accent, tags, pin
- Task rows: check-off animation, priority, due, recurrence
- Task detail slide-in
- Realtime sync dot in the top bar

## What's stubbed / placeholder

- No Markdown editor (the editor page is a stub)
- No reminder picker UI (badge only)
- No file attachments
- No real settings page
- Mobile breakpoints are not implemented (desktop only)
- Light theme tokens exist but the kit runs dark-only

Treat this as a faithful **visual** reference, not production code.
