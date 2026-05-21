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


---

## Considering

### Mobile App
A React Native app sharing auth and data with the same Supabase backend. The API is already fully in place. Offline mode (above) is a prerequisite for a good mobile experience.

---

## Completed

### Frontend Features
- [x] **AI features** — `supabase/functions/ai` Edge Function proxying to Anthropic (`claude-haiku-4-5`) with 4 actions: summarize note, suggest tags, generate task list, smart search (natural language query); AI buttons in NoteEditor format bar; smart search toggle in search results; requires `ANTHROPIC_API_KEY` Supabase secret
- [x] **Shared workspace improvements** — role management UI (owners can promote/demote/remove members), role badges (owner/admin/member), recent activity feed per workspace
- [x] **Due dates on notes** — `due_at` column on `notes`, date-time picker in NoteEditor toolbar with clear button and relative label; notes appear on the Calendar
- [x] **Calendar enhancements** — Month/Week view toggle; notes with due dates shown as diamond dots alongside task dots; drag-and-drop to reschedule tasks and notes onto different days (updates DB on drop)
- [x] **Custom note templates** — "Save as template" in the format bar stores any note's content to `profiles.settings.templates`; template modal shows "My templates" section with per-template delete, alongside 6 built-in templates
- [x] **Backlinks index** — collapsible "Backlinks" panel at the bottom of each note showing all notes that link to it via `[[Title]]`; powered by `ilike` content search, no extra migration needed
- [x] **Drag-and-drop reorder** — tasks within a list (grip handle + dnd-kit), lists in the sidebar, notes in the grid; all persisted via Supabase RPCs (`reorder_tasks`, `reorder_todo_lists`, `reorder_notes`)
- [x] **Export enhancements** — download individual notes as `.md` from the editor; export a list as Markdown or CSV; import notes from `.md` / `.txt` / `.json` files
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
