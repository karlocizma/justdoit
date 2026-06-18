# JustDoIt — Roadmap

Feature backlog and upcoming work. Items are roughly ordered by priority within each section.

---

## Planned

### Mentions in Workspaces
`@name` autocomplete in note content and task titles. Triggers a browser push notification and/or in-app badge for the mentioned member. Needs a mentions lookup in the workspace member list and changes to the push notification delivery flow.

---

### ICS Calendar Feed
A read-only, one-way calendar subscription so users can see their JustDoIt due-dates (tasks and notes with `due_at`) inside Google Calendar, Apple Calendar, Outlook, etc. A new Edge Function generates an `.ics` feed from the user's items, authenticated by a per-user, revocable feed token (not the session JWT, since calendar clients poll unattended) — likely stored on `profiles.settings`. Subscribe-URL UI in Settings with copy + regenerate. Reuses existing Edge Function patterns; no two-way sync (that would require provider OAuth + change webhooks and is out of scope here).

---

### Desktop App (Tauri)
Package the existing Next.js web app as a native desktop client via Tauri — a small (~5 MB) Rust shell reusing 100% of the frontend. The offline-first data layer and PWA service worker (see Completed) already do the hard part, so this is mostly packaging: native window/menus/tray, OS notifications, and signed auto-updating builds in CI for macOS/Windows/Linux. (Note: the app is already installable as a PWA today; this is the path to a richer native experience.)

---

### Admin Dashboard (app-operator)
An operator-facing dashboard for whoever runs the app — aggregate metrics (user count, notes/tasks volume, active workspaces, recent sign-ups) and basic health, not workspace-level admin. Requires introducing a **global admin role** (the app only has workspace owner/admin/member today): an `is_admin` flag on `profiles` or a JWT `app_metadata` role. Aggregate queries that span all users run in an Edge Function using the **service-role key** (bypassing RLS server-side) behind an admin check — the service-role key is never exposed to the browser. A new `/admin` route guarded by the global role.

---

## Considering

### Mobile App
A React Native app sharing auth and data with the same Supabase backend. The API is already fully in place, and offline mode (see Completed) is done — a key prerequisite for a good mobile experience.

---

## Completed

### Frontend Features
- [x] **Comments on Shared Notes** — discussion threads on workspace notes. New `note_comments` table (`id`, `note_id`, `user_id`, `content`, `created_at`, `updated_at`) with RLS gated on accepted workspace membership of the note's workspace (reusing `is_workspace_member`); authors can edit/delete their own comments. Collapsible Comments panel at the bottom of the NoteEditor, shown only for workspace notes, with a composer (⌘/Ctrl+Enter to post) and inline edit/delete. Live updates via a Supabase Realtime `postgres_changes` subscription on `note_comments` (the first client-side `.channel()` usage). Online-only; degrades to a notice when offline. Covered by integration tests in `scripts/test-milestone8.ts`
- [x] **Offline Mode** — local-first data layer for notes, tasks and lists. IndexedDB cache via Dexie (`src/lib/offline/`); service worker caches the app shell (network-first navigations with `/offline` fallback, stale-while-revalidate assets) so the app loads offline. Optimistic writes go through a repository that updates the cache and queues an outbox op; a FIFO flush worker (retry/backoff, stops on first failure to preserve order) replays them when online. Last-write-wins conflict resolution on `updated_at`; recurring-task completion ported client-side to match the server RPC. Sync-status menu in the TopBar (Connected / Syncing / N pending / Offline / error) with manual "Sync now" and "Retry failed"; cache cleared on sign-out. Tag editing, AI, attachments, search, workspaces and export remain online-only. Pure logic covered by unit tests (`npm run test:offline`)
- [x] **Progressive Web App (PWA)** — installable on desktop and mobile via `app/manifest.ts` (name, icons, standalone display, brand `theme_color`); generated icon set (192/512/maskable/apple-touch/notification badge) in `public/`; service worker registered app-wide via `ServiceWorkerRegister` with a minimal `fetch` handler so the app qualifies as installable (offline caching to be layered on for Offline Mode)
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
