# JustDoIt — Design Brief for Claude Design

## App Identity

- **Name:** JustDoIt
- **Tagline:** Notes & Tasks, done right.
- **Type:** Productivity web app (desktop-first, responsive)
- **Tone:** Clean, focused, calm — not corporate. Slightly dark/neutral aesthetic, feels like a developer or creator's personal workspace.

---

## Brand & Visual Direction

### Palette (suggested, open to variation)
- **Background:** Near-black `#0f1117` or very dark navy
- **Surface cards:** Slightly lighter `#1a1d27`
- **Primary accent:** Soft purple `#6c63ff`
- **Secondary accent:** Teal/cyan `#48d1cc`
- **Danger / overdue:** Muted red `#e05c5c`
- **Success / complete:** Muted green `#4caf89`
- **Warning / priority high:** Amber `#f5a623`
- **Body text:** Off-white `#e8eaf6`
- **Muted / secondary text:** Slate `#7b82a8`

> A light theme variant should also be possible — same hierarchy, inverted.

### Typography
- **Headings:** Rounded, modern sans-serif (e.g. Inter, Geist, or similar)
- **Body:** Same family, regular weight
- **Code/monospace sections:** JetBrains Mono or similar (for note code blocks)
- **Sizes:** Generous line-height (1.6–1.7) for comfortable reading

### Radius & Spacing
- Cards: 12–16px border radius
- Buttons: 8px
- Dense but breathable — not too much whitespace, not cramped
- Subtle borders on cards (not heavy shadows)

---

## Core Screens

### 1. Dashboard / Home
- Left sidebar: navigation (Dashboard, Notes, each To-Do List, Settings)
  - Workspace switcher at the top of the sidebar (personal vs. named workspaces)
- Main area: "Today" view
  - Pinned notes row (horizontal scroll or grid)
  - Today's tasks section (due today, sorted by priority)
  - Overdue tasks section (subtle warning styling)
  - Recent notes section
- Top bar: global search input (⌘K), realtime sync indicator dot, user avatar dropdown

### 2. Notes List
- Grid or masonry card layout (toggle between grid/list)
- Each note card: title, first 3 lines of content, color accent (left border or card background tint), tags as small pills, relative timestamp
- Pinned notes appear first with a pin icon
- Filter bar: All / Pinned / Archived / by Tag
- FAB (floating action button) or top-right "New Note" button

### 3. Note Editor
- Full-screen-ish editor with sidebar still visible
- Title field (large, clean)
- Markdown-rendered content area — toggle between edit and preview
- Right panel (collapsible): color picker, tags, pin/archive toggle, created/updated timestamps
- **Attachments section** in right panel:
  - Upload zone (drag-and-drop or click to browse)
  - List of attached files with icon by type (image thumbnail, PDF icon, text icon)
  - Click to open signed URL in new tab; trash icon to delete
  - Upload progress indicator; max 5 MB per file
- **Reminder section** in right panel:
  - "Add reminder" button opens a datetime picker
  - Shows existing reminder with channel badge (In-App / Email / Push) and time
  - Cancel button next to existing reminder
- Auto-save indicator (subtle "Saved" text fading in/out near top bar)
- Clean, distraction-free feel

### 4. To-Do List View
- List header: icon + title + task count / completed count
- Task items:
  - Checkbox (custom styled, satisfying animation on complete)
  - Task title (strikethrough when completed)
  - Due date badge (colour-coded: normal / today = accent / overdue = red)
  - Priority dot or label (high = amber/red, medium = yellow, low = subtle)
  - Recurrence icon (↻) if task has a recurrence rule — tooltip shows "Repeats weekly" etc.
  - Expand chevron for sub-tasks
  - Hover: shows edit/delete actions
- Section dividers: "Active" / "Completed" (completed collapsed by default)
- Add task input at top or bottom of list (inline, no modal)

### 5. Task Detail Panel (slide-in from right)
- Full task view: title, notes textarea, due date picker, time picker (optional)
- Priority selector (None / Low / Medium / High) — segmented control or dropdown
- **Recurrence section:**
  - Toggle "Repeat" on/off
  - When on: frequency selector (Daily / Weekly / Monthly / Yearly) + interval input ("every N weeks") + optional end date
  - Display: "Repeats every 2 weeks" summary text
- **Reminder section:**
  - "Add reminder" datetime picker (date + time)
  - Channel selector: In-App / Email / Push
  - Shows existing reminder; "Cancel reminder" link
- Sub-tasks section with their own checkboxes and inline add
- Created/updated timestamps

### 6. Search Results
- Unified results page: Notes results + Task results in separate sections
- Highlighted matching text
- Keyboard navigation (arrow keys, Enter to open)

### 7. Auth Pages (Login / Register / Reset Password)
- Centered card on dark background
- **Login:** Email + password fields, "Sign in" button, divider, OAuth buttons (GitHub, Google), link to Register and Forgot Password
- **Register:** Email + password + confirm password, submit, then "Check your email to confirm" state
- **Forgot password:** Email field → success state "Reset link sent"
- **Reset password:** New password + confirm, triggered from email link (Supabase handles the token via URL fragment)
- No clutter — one action per page

### 8. Settings
- Simple two-column layout: nav on left, content on right
- **Profile:** Display name, avatar URL, Save button
- **Appearance:** Theme toggle (dark / light), accent color picker
- **Notifications:** Toggle digest email on/off (maps to `settings.digest_enabled`)
- **Export:** "Export my data" button — triggers ZIP export, delivered to your email when ready. Shows a "Export requested — check your inbox" confirmation state after click.
- **Account:** Delete account (destructive, confirm dialog)

### 9. Workspaces
- **Workspace switcher** (in sidebar, top section):
  - "Personal" entry (default)
  - List of workspaces the user belongs to (accepted invites only)
  - "+ New Workspace" button at the bottom
  - Active workspace highlighted; switching reloads notes + lists scoped to that workspace

- **Workspace Settings page** (accessible from sidebar or settings):
  - Workspace name (editable by owner/admin)
  - **Members list:**
    - Each row: avatar + display name + email, role badge (Owner / Admin / Member), "Remove" button (owner/admin only), pending badge for unaccepted invites
  - **Invite member** section:
    - Email input + role selector (Member / Admin) + "Send Invite" button
    - Success state: "Invite sent to user@example.com"
    - Error state: "No account found for that email"
  - **Danger zone:** Delete workspace (owner only) — confirm dialog

- **Pending invites banner:**
  - If the user has a pending workspace invite, show a dismissible banner at the top of the app: "You've been invited to join [Workspace Name] — Accept / Decline"

---

## UI Components Needed

| Component | Notes |
|---|---|
| Sidebar nav | Collapsible, list icons + labels, active state highlight, workspace switcher at top |
| Workspace switcher | Dropdown or section at top of sidebar; personal + workspaces list |
| Note card | Color accent, tags, pin icon, hover actions |
| Task item | Checkbox, priority, due badge, recurrence icon, sub-task expander |
| Tag pill | Small, colored, removable |
| Priority badge | 4 levels: none / low / medium / high |
| Due date badge | Colour-coded: normal / today (accent) / overdue (red) |
| Recurrence selector | Frequency + interval + end-date (in task detail panel) |
| Reminder picker | Date + time + channel selector (in note editor and task detail) |
| File attachment row | Icon by type, filename, delete button; upload drop zone |
| Upload progress bar | Inline in attachment section during upload |
| Search bar | Global, keyboard shortcut ⌘K / Ctrl+K |
| Color picker | 8–12 preset swatches (for notes and lists) |
| FAB / New button | Create note or task quickly |
| Toast notifications | Success, error, info — slide in from bottom |
| Modal / slide panel | For task detail |
| Completion animation | Checkbox check with subtle pulse |
| Realtime sync dot | Small indicator in top bar — green = connected, grey = reconnecting |
| Pending invite banner | Dismissible, top of app, "Accept / Decline" actions |
| Empty state illustrations | For empty notes list, empty task list, empty workspace |

---

## Key UX Principles

1. **Keyboard-first:** ⌘K search, keyboard shortcuts for new note/task, Markdown editor shortcuts.
2. **Instant feedback:** Optimistic UI updates — toggling a task complete feels instant.
3. **Calm, not overwhelming:** The UI should feel like a quiet workspace, not a dashboard full of stats.
4. **Progressive disclosure:** Basic task view is minimal; detail panel reveals more options.
5. **Drag to reorder:** Notes and tasks should feel draggable with clear drop targets.
6. **Real-time, silently:** Realtime sync happens in the background — no jarring refreshes. The sync indicator shows connection state without demanding attention.

---

## Interaction Notes

- Completing a task: checkbox animates, row fades slightly then slides down to "Completed" section. For recurring tasks, the due date advances silently — no "completed" state shown.
- Creating a note: clicking "New Note" creates it immediately with a blank title and focuses the title field
- Sidebar list items: to-do lists listed individually with their icon and count badge
- Drag to reorder: notes cards and task rows are draggable; `reorder_notes` / `reorder_tasks` RPC called on drop
- File upload: drag a file onto the note editor to attach it; progress bar shows inline
- Mobile: sidebar collapses to a hamburger/tab-bar at bottom; grid becomes single-column; task detail panel becomes full-screen sheet

---

## API Reference

All data comes from Supabase. Base URL: `https://<project-ref>.supabase.co`

Authentication: every request includes `Authorization: Bearer <access_token>` (JWT issued by Supabase Auth, auto-managed by supabase-js).

### PostgREST (CRUD)

All table endpoints live at `/rest/v1/<table>`. Row Level Security is enforced server-side — no client-side filtering needed for ownership.

```
GET    /rest/v1/notes?is_archived=eq.false&deleted_at=is.null&order=is_pinned.desc,sort_order.asc&select=*,note_tags(tag:tags(*))
POST   /rest/v1/notes
PATCH  /rest/v1/notes?id=eq.<id>
DELETE /rest/v1/notes?id=eq.<id>

GET    /rest/v1/tags
POST   /rest/v1/tags
PATCH  /rest/v1/tags?id=eq.<id>
DELETE /rest/v1/tags?id=eq.<id>

POST   /rest/v1/note_tags          { note_id, tag_id }
DELETE /rest/v1/note_tags?note_id=eq.<id>&tag_id=eq.<id>

GET    /rest/v1/todo_lists?order=sort_order.asc
POST   /rest/v1/todo_lists
PATCH  /rest/v1/todo_lists?id=eq.<id>
DELETE /rest/v1/todo_lists?id=eq.<id>

GET    /rest/v1/tasks?list_id=eq.<id>&parent_id=is.null&order=sort_order.asc&select=*,sub_tasks:tasks!parent_id(*)
POST   /rest/v1/tasks
PATCH  /rest/v1/tasks?id=eq.<id>
DELETE /rest/v1/tasks?id=eq.<id>

GET    /rest/v1/reminders?task_id=eq.<id>
POST   /rest/v1/reminders
DELETE /rest/v1/reminders?id=eq.<id>

GET    /rest/v1/workspaces
POST   /rest/v1/workspaces
PATCH  /rest/v1/workspaces?id=eq.<id>
DELETE /rest/v1/workspaces?id=eq.<id>

GET    /rest/v1/workspace_members?workspace_id=eq.<id>&select=*,profile:profiles(display_name,avatar_url)
DELETE /rest/v1/workspace_members?workspace_id=eq.<id>&user_id=eq.<id>

GET    /rest/v1/profiles?id=eq.<user_id>
PATCH  /rest/v1/profiles?id=eq.<user_id>
```

### RPCs

```
POST /rest/v1/rpc/toggle_task_complete    { task_id: uuid }
POST /rest/v1/rpc/reorder_notes           { updates: [{ id, sort_order }] }
POST /rest/v1/rpc/reorder_todo_lists      { updates: [{ id, sort_order }] }
POST /rest/v1/rpc/reorder_tasks           { list_id: uuid, updates: [{ id, sort_order }] }
POST /rest/v1/rpc/search_all              { query: string }
POST /rest/v1/rpc/get_notes_by_tag        { tag_name: string }
POST /rest/v1/rpc/accept_workspace_invite { p_workspace_id: uuid }
```

### Edge Functions

```
GET  /functions/v1/dashboard
GET  /functions/v1/search?q=<query>&type=notes|tasks|all&limit=20
POST /functions/v1/export
POST /functions/v1/reminder-cancel        { reminder_id: uuid }
POST /functions/v1/workspace-invite       { workspace_id, email, role }
```

### Key Response Shapes

```ts
// Note (with tags)
{
  id: string
  user_id: string
  workspace_id: string | null
  title: string
  content: string                  // Markdown
  color: string | null             // hex, e.g. "#6c63ff"
  is_pinned: boolean
  is_archived: boolean
  deleted_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
  note_tags: Array<{
    tag: { id: string; name: string; color: string | null }
  }>
}

// Task (with sub-tasks)
{
  id: string
  list_id: string
  parent_id: string | null
  title: string
  notes: string | null
  is_completed: boolean
  completed_at: string | null
  due_date: string | null          // "YYYY-MM-DD"
  due_time: string | null          // "HH:MM:SS"
  priority: 0 | 1 | 2 | 3         // none / low / medium / high
  sort_order: number
  recurrence: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number              // default 1
    until?: string                 // "YYYY-MM-DD"
  } | null
  created_at: string
  updated_at: string
  sub_tasks?: Task[]               // when fetched with !parent_id embed
}

// Reminder
{
  id: string
  user_id: string
  task_id: string | null
  note_id: string | null
  remind_at: string                // ISO timestamp
  channel: 'in_app' | 'email' | 'push'
  is_sent: boolean
  created_at: string
}

// Dashboard response
{
  pinned_notes: Note[]
  today_tasks: Task[]
  overdue_tasks: Task[]
  stats: {
    total_notes: number
    open_tasks: number
    completed_today: number
    lists_count: number
  }
}

// Workspace
{
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

// Workspace member (with profile join)
{
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  invited_by: string | null
  invited_at: string
  accepted_at: string | null       // null = pending invite
  profile: {
    display_name: string
    avatar_url: string | null
  }
}
```

### Storage

```
PUT    /storage/v1/object/note-attachments/{user_id}/{note_id}/{filename}
GET    /storage/v1/object/sign/note-attachments/{path}    (creates signed URL)
GET    /storage/v1/object/list/note-attachments/{user_id}/{note_id}
DELETE /storage/v1/object/note-attachments/{path}
```

Max file size: 5 MB. Allowed MIME types: `image/*`, `application/pdf`, `text/plain`, `text/markdown`.

### Realtime

Subscribe via Supabase Realtime WebSocket. Tables published: `notes`, `tasks`, `todo_lists`, `workspace_members`. RLS is enforced — users only receive events for rows they can read.

```
wss://<project-ref>.supabase.co/realtime/v1/websocket
```

---

## Auth Flow (Supabase)

- **Email signup:** POST to Supabase Auth → confirmation email sent → user clicks link → session created → profile row auto-created by database trigger
- **Email login:** POST credentials → JWT (access token, 1 hour) + refresh token (in memory/cookie via supabase-js) returned
- **OAuth (GitHub/Google):** Redirect to provider → callback to `/auth/callback` → `exchangeCodeForSession` → session created
- **Password reset:** Request email → Supabase sends reset link → user clicks → redirect to `/auth/reset-password` with token in URL fragment → update password via `supabase.auth.updateUser`
- **Session refresh:** supabase-js handles automatically; `onAuthStateChange` fires on `TOKEN_REFRESHED`
- **Sign out:** `supabase.auth.signOut()` — clears local session and invalidates refresh token
