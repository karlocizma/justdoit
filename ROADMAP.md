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

### Comments on Shared Notes
Discussion threads on notes inside a workspace. New `note_comments` table (columns: `id`, `note_id`, `user_id`, `content`, `created_at`). Comments shown in a collapsible panel at the bottom of the NoteEditor, visible only to workspace members. Natural follow-on to the activity feed.

---

### Mentions in Workspaces
`@name` autocomplete in note content and task titles. Triggers a browser push notification and/or in-app badge for the mentioned member. Needs a mentions lookup in the workspace member list and changes to the push notification delivery flow.

---

### Two-Factor Authentication (2FA)
TOTP-based 2FA (Google Authenticator, 1Password, etc.). Supabase Auth already supports `enrollMFA` / `challengeMFA` — this is purely a Settings UI to enroll, verify, and unenroll. No backend changes needed beyond enabling the feature in the Supabase dashboard.

---

## Considering

### Mobile App
A React Native app sharing auth and data with the same Supabase backend. The API is already fully in place. Offline mode (above) is a prerequisite for a good mobile experience.

---

## Completed

### Frontend Features
- [x] **Kanban board view** — toggle between list and board view in any task list; drag cards between To Do / In Progress / Done columns via `@dnd-kit`; status synced to DB; assignee avatar and priority badge on cards
- [x] **Note version history** — throttled snapshots saved to `note_versions` table; History panel in the note editor with version list, diff preview, and one-click restore
- [x] **Task assignment in workspaces** — `assigned_to` column on `tasks`; workspace member picker in the task detail panel; "Assigned to me" filter toggle in the task list header; status picker (To Do / In Progress / Done) in task detail
- [x] **Two-factor authentication (2FA)** — TOTP-based 2FA via Supabase Auth MFA (`enrollMFA` / `challengeMFA`); enrollment UI with QR code in Settings → Two-factor authentication; `mfa-challenge` screen in the login flow
- [x] **Note Graph View** — `/graph` route with D3.js force-directed canvas showing `[[Title]]` note connections; zoom/pan/drag; node tooltips; click to open note; linked-only or show-all toggle
- [x] **Attachment uploads in notes** — "📎 Attach" button in the format bar uploads files/images to the `note-attachments` Supabase Storage bucket; inserts a Markdown image or link at cursor position
- [x] **Bulk actions on notes** — "Select" mode in the notes grid adds checkboxes; action bar with Archive and Trash buttons for the selected items
- [x] **Bulk actions on tasks** — "Select" mode in the task list adds checkboxes; action bar with Complete and Delete buttons
- [x] **Print view** — `@media print` CSS hides sidebar, topbar, and editor toolbar via `data-role` / `data-print` attributes; notes render cleanly when printed or saved as PDF
- [x] **Focus mode** — toggle button (expand icon) in NoteEditor toolbar and `F` key shortcut; hides sidebar and topbar via `html[data-focus="true"]` CSS; `Esc` to exit
- [x] **Syntax highlighting in preview** — `marked-highlight` + `highlight.js` (github-dark theme) in the Markdown preview; fenced code blocks get language-aware colours
- [x] **Keyboard shortcuts reference** — `?` key anywhere in the app opens a modal listing all shortcuts; `Esc` to close
- [x] **AI features** — `supabase/functions/ai` Edge Function proxying to Anthropic (`claude-haiku-4-5`) with 4 actions: summarize note, suggest tags, generate task list, smart search (natural language query); AI buttons in NoteEditor format bar; smart search toggle in search results; requires `ANTHROPIC_API_KEY` Supabase secret
- [x] **Shared workspace improvements** — role management UI (owners can promote/demote/remove members), role badges (owner/admin/member), recent activity feed per workspace
- [x] **Due dates on notes** — `due_at` column on `notes`, date-time picker in NoteEditor toolbar with clear button and relative label; notes appear on the Calendar
- [x] **Calendar enhancements** — Month/Week view toggle; notes with due dates shown as diamond dots alongside task dots; drag-and-drop to reschedule tasks and notes onto different days (updates DB on drop)
- [x] **Custom note templates** — "Save as template" in the format bar stores any note's content to `profiles.settings.templates`; template modal shows "My templates" section with per-template delete, alongside 6 built-in templates
- [x] **Backlinks index** — collapsible "Backlinks" panel at the bottom of each note showing all notes that link to it via `[[Title]]`; powered by `ilike` content search, no extra migration needed
- [x] **Drag-and-drop reorder** — tasks within a list (grip handle + dnd-kit), lists in the sidebar, notes in the grid; all persisted via Supabase RPCs (`reorder_tasks`, `reorder_todo_lists`, `reorder_notes`)
- [x] **Export enhancements** — download individual notes as `.md` from the editor; export a list as Markdown or CSV; import notes from `.md` / `.txt` / `.json` files
- [x] Next.js 16 frontend with full auth flow (email/password, OAuth)
- [x] **GitHub and Google OAuth** — "Continue with GitHub / Google" buttons are fully implemented in `AuthCard.tsx`; activate by creating OAuth apps in the GitHub/Google developer consoles and pasting the credentials into Supabase dashboard → Authentication → Providers (steps in `CLOUD_SETUP.md`)
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
