# JustDoIt — Roadmap

Feature backlog and upcoming work. Items are roughly ordered by priority within each section.

---

## In Progress / Next Up

### Offline Mode
Allow the app to work without an internet connection and sync automatically when the connection is restored.

**Scope:**
- **Local data store** — IndexedDB via [Dexie.js](https://dexie.org/) to cache notes and tasks locally
- **Service worker** — cache the Next.js app shell so the UI loads offline
- **Write queue** — buffer mutations locally when offline, replay against Supabase when the connection returns
- **Conflict resolution** — last-write-wins based on `updated_at` timestamp (covers the common case; CRDTs are an option if more granularity is needed later)
- **Sync indicator** — visible badge when there are unsynced local changes

**Depends on:** nothing blocking; can be layered on top of the current Supabase client pattern.

---

## Planned

### Progressive Web App (PWA)
Installable from the browser on desktop and mobile. Pairs directly with offline mode — the service worker needed for offline caching also enables PWA install prompts. Requires a Web App Manifest and icon set.

### Keyboard Shortcuts & Command Palette
A `⌘K` / `Ctrl+K` command palette for quick navigation and actions: jump to any note or list, create a new note, search, switch workspaces. Complements the existing full-text search.

Individual shortcuts: `N` for new note, `T` for new task, `P` to toggle pin, `E` to toggle edit/preview mode.

### Browser Push Notifications
Deliver reminders as browser push notifications in addition to (or instead of) email. Uses the Web Push API + a Supabase Edge Function to send notifications. Users can opt in per-device from Settings.

### Dark / Light Theme Toggle
The CSS already has both themes via `[data-theme="light"]` overrides in `tokens.css`. Wire up a toggle in the Settings page and persist the preference in `profiles.settings`.

### Calendar View
Monthly/weekly calendar showing tasks with due dates. Clicking a day shows tasks due that day. Drag-and-drop to reschedule. Good companion to the daily digest email.

### Note Linking
`[[Note Title]]` wiki-style internal links in the Markdown editor. Clicking a link opens the referenced note. Autocompletion dropdown when typing `[[`. Requires a link-extraction pass to build a backlinks index.

### Note Templates
Pre-defined templates selectable when creating a new note: Meeting Notes, Project Plan, Daily Journal, Bug Report, etc. Templates are just Markdown strings injected into the content field on creation. Users can also save their own notes as templates.

### Drag-and-Drop Reorder
- Reorder tasks within a list by dragging (already has a `sort_order` column and `reorder_tasks` RPC)
- Reorder lists in the sidebar
- Reorder notes in the notes grid (pin is the current proxy for this)

### Export Enhancements
- Download individual notes as `.md` files directly from the editor (no email required)
- Export a full list as Markdown or CSV
- Notion-compatible JSON import

---

## Considering

### AI Features
- **Summarize note** — one-click summary of a long note using the Claude API
- **Suggest tags** — automatically propose tags based on note content
- **Generate task list** — extract action items from a note as tasks
- **Smart search** — natural language query ("show me notes about the Berlin trip") instead of keyword search

These would call a new Edge Function that proxies to the Anthropic API with the user's note content. Requires an `ANTHROPIC_API_KEY` secret.

### Mobile App
A React Native app sharing auth and data with the same Supabase backend. The API is already fully in place. Offline mode (above) is a prerequisite for a good mobile experience.

### Shared Workspace Improvements
- Workspace-level roles: fine-grained permissions (read-only member vs. editor vs. admin)
- Activity feed: see what teammates changed recently
- @mentions in notes that notify the mentioned user

### Due Dates on Notes
Notes can have a `due_at` timestamp alongside tasks. Appears in the calendar view and daily digest.

---

## Completed

- [x] Supabase backend: auth, notes, tasks, tags, reminders, recurring tasks, workspaces, RLS
- [x] Edge Functions: dashboard, search, export, reminder-webhook/cancel, workspace-invite
- [x] Trigger.dev background jobs: reminders, recurring tasks, daily digest, export ZIP
- [x] Next.js 16 frontend with full auth flow (email/password, OAuth)
- [x] Notes list with tag filter chips
- [x] Note editor: Markdown preview toggle, formatting toolbar, word/character count, tag management, color labels, pin
- [x] Task lists with sub-tasks, reorder, completion, recurring tasks
- [x] Shared workspaces: create, invite members, accept invites, leave/delete
- [x] Archive and Trash with restore / hard delete
- [x] Data export (ZIP, delivered via email)
- [x] Daily digest email toggle in Settings
- [x] Real-time sync via Supabase Realtime WebSocket
- [x] Supabase Storage for note attachments and exports
- [x] Design system: CSS Modules + `--jd-` design tokens, dark theme canonical
