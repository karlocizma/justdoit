# JustDoIt — Roadmap

Feature backlog and upcoming work. Items are roughly ordered by priority within each section.

---

## In Progress / Next Up

### Offline Mode
Allow the app to work without an internet connection and sync automatically when the connection is restored.

**Scope:**
- **Local data store** — IndexedDB via [Dexie.js](https://dexie.org/) to cache notes and tasks locally
- **Service worker** — cache the Next.js app shell so the UI loads offline (the push notification service worker `public/sw.js` is already registered — extend it)
- **Write queue** — buffer mutations locally when offline, replay against Supabase when the connection returns
- **Conflict resolution** — last-write-wins based on `updated_at` timestamp (covers the common case; CRDTs are an option if more granularity is needed later)
- **Sync indicator** — visible badge when there are unsynced local changes

**Depends on:** the service worker added for push notifications is a natural starting point.

---

## Planned

### Progressive Web App (PWA)
Installable from the browser on desktop and mobile. Pairs directly with offline mode — the service worker needed for offline caching also enables PWA install prompts. Requires a Web App Manifest and icon set.

### Drag-and-Drop Reorder
- Reorder tasks within a list by dragging (DB already has `sort_order` column and `reorder_tasks` RPC)
- Reorder lists in the sidebar
- Reorder notes in the notes grid (pin is the current proxy for this)

### Export Enhancements
- Download individual notes as `.md` files directly from the editor (no email required)
- Export a full list as Markdown or CSV
- Notion-compatible JSON import

### Custom Note Templates
Users can save any note as a personal template. Currently 6 built-in templates exist; this adds user-defined templates stored in `profiles.settings`.

### Backlinks Index for Note Linking
The `[[Title]]` note linking is live. Backlinks — a panel showing which other notes link to the current note — requires a server-side index (e.g. a `note_links` table populated on save) or a full-text search over `content` for `[[CurrentTitle]]`.

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

### Calendar Enhancements
- Weekly view alongside the current monthly view
- Drag-and-drop on the calendar to reschedule tasks

---

## Completed

### Frontend Features
- [x] Next.js 16 frontend with full auth flow (email/password, OAuth)
- [x] **Dark / light theme toggle** — Sun/Moon button in TopBar, persists to localStorage, no-flash inline script
- [x] **Calendar view** — `/calendar` route with monthly grid, priority-colour dots, side panel for day's tasks
- [x] **Command palette** — `⌘K` / `Ctrl+K` global shortcut, live note/list search, arrow key navigation; `N` = new note, `/` = search
- [x] **Note templates** — 6 built-in templates (Meeting Notes, Project Plan, Daily Journal, Bug Report, Weekly Review, Book Notes); replace or append to existing content
- [x] **Note linking** — `[[Title]]` autocomplete in editor, clickable links in preview mode, unresolved links highlighted
- [x] **Browser push notifications** — VAPID-signed Web Push, `push_subscriptions` table, opt-in toggle in Settings
- [x] Notes list with tag filter chips
- [x] Note editor: Markdown preview toggle, formatting toolbar, word/character count, tag management, colour labels, pin
- [x] Task lists with sub-tasks, reorder, completion, recurring tasks
- [x] Shared workspaces: create, invite members, accept invites, leave/delete
- [x] Archive and Trash with restore / hard delete
- [x] Data export (ZIP, delivered via email)
- [x] Daily digest email toggle in Settings
- [x] Design system: CSS Modules + `--jd-` design tokens, dark theme canonical

### Backend & Infrastructure
- [x] Supabase backend: auth, notes, tasks, tags, reminders, recurring tasks, workspaces, RLS
- [x] Edge Functions: `dashboard`, `search`, `export`, `reminder-webhook`, `reminder-cancel`, `workspace-invite`, `push-subscribe`, `push-send`
- [x] Trigger.dev background jobs: reminders, recurring tasks, daily digest, export ZIP
- [x] Real-time sync via Supabase Realtime WebSocket
- [x] Supabase Storage for note attachments and exports
- [x] `push_subscriptions` table with RLS for browser push notification delivery
