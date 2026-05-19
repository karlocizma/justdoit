# JustDoIt — Web App UI Kit

A high-fidelity prototype of the JustDoIt productivity web app, built strictly against `design-brief.md`. There is no production frontend repo to copy from — these components are the canonical visual reference.

## How to use

Open `index.html` directly in a browser (no build step, no install) — it's a click-thru prototype that lets you sign in, browse the dashboard, open notes, manage tasks, and explore settings. State is in-memory only; everything resets on refresh.

## File index

```
├── index.html              — entry point; loads React 18 + Babel + every component
├── App.jsx                 — top-level shell, view router, mock state
├── Icons.jsx               — Lucide SVG components (inlined, no CDN dependency)
├── Brand.jsx               — logo wordmark + logomark
├── Popover.jsx             — floating menu / dropdown primitive
├── Modals.jsx              — NewListModal, NewWorkspaceModal
├── Sidebar.jsx             — workspace switcher + nav rail + user popover
├── TopBar.jsx              — search input, realtime sync dot, avatar
├── Dashboard.jsx           — Today view (pinned notes + tasks + overdue)
├── NotesView.jsx           — note grid with filter bar
├── NoteCard.jsx            — single note card (used in dashboard + notes grid)
├── NoteEditor.jsx          — Markdown editor with right-rail (color, tags, reminder, attachments)
├── CollectionViews.jsx     — Archive view + Trash view
├── SearchView.jsx          — search results grouped by Notes / Tasks, with highlight
├── TasksView.jsx           — to-do list view with inline add
├── TaskRow.jsx             — single task row (checkbox, priority, due, recurrence)
├── TaskDetailPanel.jsx     — slide-in panel (priority, recurrence, reminder, sub-tasks, notes)
├── SettingsView.jsx        — settings: profile, appearance, notifications, workspaces, export, account
└── AuthCard.jsx            — login / register / forgot / reset-password flow
```

## What's covered

- Full auth flow: login, register, forgot password, check-email confirmation, set-new-password
- Sidebar nav with workspace switcher popover and user menu
- Pending workspace invite banner (dismissible, accept/decline)
- Dashboard: pinned notes row, today's tasks, overdue tasks
- Note grid with color accent, tags, pin icon, filter bar
- Note editor with right-rail: color picker, tags, pin/archive toggle, reminder button, attachment upload zone, timestamps
- Search: wired to TopBar input, live-filtered results with keyword highlight, grouped Notes / Tasks sections
- Task list with checkboxes, priority dots, due-date badges, recurrence icons
- Task detail slide-in: priority segmented control, recurrence toggle + interval selector, reminder toggle + channel selector, sub-tasks (add/complete/remove), notes textarea
- Settings: profile form, theme + accent picker, notification toggles, workspace members + invite + delete, export button, account / OAuth management
- Realtime sync dot in top bar (connected / reconnecting state)
- Archive view, Trash view

## What's not implemented

- No real Markdown rendering (editor uses a plain `<textarea>`)
- Mobile breakpoints not implemented (desktop-only)
- Light theme tokens exist in `colors_and_type.css` but the kit runs dark-only
- Drag-to-reorder is not wired (visual only)
- No actual file upload (attachment zone is visual only)

Treat this as a faithful **visual and interaction** reference, not production code.
