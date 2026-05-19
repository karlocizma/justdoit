# API Reference

All API calls require the `apikey` header (your project's anon key) and — for authenticated routes — an `Authorization: Bearer <jwt>` header obtained from Supabase Auth.

Base URL (local dev): `http://127.0.0.1:14321`
Base URL (production): `https://<project-ref>.supabase.co`

---

## Authentication

Supabase Auth handles all auth flows. Use the supabase-js client:

```ts
// Sign up
const { data, error } = await supabase.auth.signUp({ email, password })

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// OAuth (GitHub / Google)
await supabase.auth.signInWithOAuth({ provider: 'github' })

// Sign out
await supabase.auth.signOut()

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

The JWT is automatically attached to all supabase-js client calls. Row Level Security enforces per-user data isolation.

---

## PostgREST (CRUD)

Full CRUD is auto-generated for every table. All endpoints live at `/rest/v1/<table>`.

The TypeScript types in `shared/database.types.ts` fully describe every table's `Row`, `Insert`, and `Update` shapes.

### Profiles

```ts
// Get own profile
const { data } = await supabase.from('profiles').select('*').single()

// Update display name
await supabase.from('profiles').update({ display_name: 'Alice' }).eq('id', userId)
```

`settings` is a free-form JSONB field. Known keys: `{ digest_enabled: boolean }`.

---

### Notes

```ts
// List active notes (paginated)
const { data } = await supabase
  .from('notes')
  .select('*, note_tags(tag_id, tags(id, name, color))')
  .is('deleted_at', null)
  .order('is_pinned', { ascending: false })
  .order('sort_order')
  .range(0, 19)

// Create
const { data } = await supabase
  .from('notes')
  .insert({ title: 'My note', content: '## Hello', color: '#6c63ff' })
  .select().single()

// Update
await supabase.from('notes').update({ title: 'Updated' }).eq('id', noteId)

// Soft-delete (move to trash)
await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', noteId)

// Restore from trash
await supabase.from('notes').update({ deleted_at: null }).eq('id', noteId)

// Hard-delete
await supabase.from('notes').delete().eq('id', noteId)

// Pin/unpin
await supabase.from('notes').update({ is_pinned: true }).eq('id', noteId)

// Archive/unarchive
await supabase.from('notes').update({ is_archived: true }).eq('id', noteId)
```

**Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner (set automatically from JWT) |
| `workspace_id` | uuid? | Workspace this note belongs to (null = personal) |
| `title` | varchar(500) | Note title |
| `content` | text | Markdown body |
| `color` | varchar(20)? | Hex color for card accent |
| `is_pinned` | boolean | Pinned notes appear first |
| `is_archived` | boolean | Archived notes hidden from main view |
| `deleted_at` | timestamptz? | Soft delete timestamp (null = active) |
| `sort_order` | integer | Position in the list (0-indexed) |

---

### Tags

```ts
// List own tags
const { data } = await supabase.from('tags').select('*').order('name')

// Create
const { data } = await supabase.from('tags').insert({ name: 'work', color: '#6c63ff' }).select().single()

// Add tag to note
await supabase.from('note_tags').insert({ note_id, tag_id })

// Remove tag from note
await supabase.from('note_tags').delete().eq('note_id', noteId).eq('tag_id', tagId)
```

---

### To-Do Lists

```ts
// List all lists
const { data } = await supabase.from('todo_lists').select('*').order('sort_order')

// Create
const { data } = await supabase
  .from('todo_lists')
  .insert({ title: 'Shopping', icon: '🛒', color: '#48d1cc' })
  .select().single()

// Create in workspace
const { data } = await supabase
  .from('todo_lists')
  .insert({ title: 'Team Backlog', workspace_id: workspaceId })
  .select().single()
```

**Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Creator/owner |
| `workspace_id` | uuid? | Workspace (null = personal) |
| `title` | varchar(200) | List name |
| `color` | varchar(20)? | Hex accent color |
| `icon` | varchar(50)? | Emoji or icon identifier |
| `is_archived` | boolean | Archived lists hidden from main nav |
| `sort_order` | integer | Sidebar position |

---

### Tasks

```ts
// Get tasks in a list (with sub-tasks)
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('list_id', listId)
  .is('parent_id', null)
  .order('sort_order')

// Get sub-tasks
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('parent_id', parentTaskId)

// Create task
const { data } = await supabase
  .from('tasks')
  .insert({
    list_id: listId,
    title: 'Write tests',
    priority: 2,              // 0=none, 1=low, 2=medium, 3=high
    due_date: '2026-06-01',
  })
  .select().single()

// Create recurring task
const { data } = await supabase
  .from('tasks')
  .insert({
    list_id: listId,
    title: 'Weekly standup',
    due_date: '2026-05-20',
    recurrence: { freq: 'weekly', interval: 1 },
  })
  .select().single()

// Recurring task with end date
const { data } = await supabase
  .from('tasks')
  .insert({
    list_id: listId,
    title: 'Sprint review',
    due_date: '2026-05-20',
    recurrence: { freq: 'weekly', interval: 2, until: '2026-12-31' },
  })
  .select().single()
```

**Recurrence format** (`recurrence` JSONB):
```ts
{
  freq:      'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number        // default 1
  until?:    string        // ISO date string 'YYYY-MM-DD'
}
```

**Priority levels:** `0` = none · `1` = low · `2` = medium · `3` = high

---

### Reminders

```ts
// Create reminder for a task
const { data } = await supabase
  .from('reminders')
  .insert({
    task_id: taskId,
    remind_at: '2026-06-01T09:00:00Z',
    channel: 'email',   // 'email' | 'in_app' | 'push'
  })
  .select().single()

// Create reminder for a note
const { data } = await supabase
  .from('reminders')
  .insert({ note_id: noteId, remind_at: '2026-06-01T09:00:00Z', channel: 'email' })
  .select().single()

// Cancel reminder (fires Trigger.dev cancel + deletes row)
const res = await fetch(`${SUPABASE_URL}/functions/v1/reminder-cancel`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ reminder_id: reminderId }),
})
```

Exactly one of `task_id` or `note_id` must be set (enforced by DB constraint).

---

### Workspaces

```ts
// Create workspace (creator is auto-added as 'owner' member)
const { data } = await supabase
  .from('workspaces')
  .insert({ name: 'Team Alpha' })
  .select().single()

// List workspaces you belong to
const { data } = await supabase.from('workspaces').select('*')

// Invite a user (must be workspace owner or admin)
const res = await fetch(`${SUPABASE_URL}/functions/v1/workspace-invite`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ workspace_id: workspaceId, email: 'colleague@example.com' }),
})
// Response: { invited: true, user_id } | { already_member: true } | 4xx error

// Accept a pending invite
await supabase.rpc('accept_workspace_invite', { p_workspace_id: workspaceId })

// List workspace members
const { data } = await supabase
  .from('workspace_members')
  .select('*, profiles(display_name, avatar_url)')
  .eq('workspace_id', workspaceId)

// Leave a workspace
await supabase
  .from('workspace_members')
  .delete()
  .eq('workspace_id', workspaceId)
  .eq('user_id', currentUserId)
```

**Member roles:** `owner` · `admin` · `member`

**Invite flow:**
1. Owner/admin calls `workspace-invite` Edge Function with `{ workspace_id, email }`
2. Invited user gets a `workspace_members` row with `accepted_at = null`
3. Invited user calls `accept_workspace_invite` RPC to accept
4. After accepting, the user can read/write all workspace notes and lists

---

## RPCs (Remote Procedure Calls)

### `toggle_task_complete(task_id)`

Toggles a task's completion state. For recurring tasks, advancing the due date instead of marking complete.

```ts
const { data: task } = await supabase.rpc('toggle_task_complete', { task_id: taskId })
// Returns the updated task row
```

Behavior:
- **Non-recurring:** Toggles `is_completed`, sets/clears `completed_at`
- **Recurring, next date ≤ until:** Sets `is_completed = false`, advances `due_date` to next occurrence
- **Recurring, next date > until:** Marks `is_completed = true` (recurrence exhausted)

---

### `search_all(query)`

Full-text search across notes and tasks (trigram-based, fast even for partial matches).

```ts
const { data: results } = await supabase.rpc('search_all', { query: 'meeting notes' })
// Returns: Array<{ id, type: 'note'|'task', title, snippet, updated_at, ... }>
```

Or use the Edge Function for type filtering and limit:
```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/search?q=meeting&type=note&limit=10`, {
  headers: { Authorization: `Bearer ${jwt}` }
})
const { results } = await res.json()
```

---

### `reorder_notes(updates)` / `reorder_todo_lists(updates)` / `reorder_tasks(list_id, updates)`

Bulk-update sort_order in a single round-trip. Used for drag-and-drop reordering.

```ts
// Reorder notes
await supabase.rpc('reorder_notes', {
  updates: [
    { id: 'uuid-1', sort_order: 0 },
    { id: 'uuid-2', sort_order: 1 },
  ]
})

// Reorder tasks within a list
await supabase.rpc('reorder_tasks', {
  p_list_id: listId,
  updates: [
    { id: 'uuid-a', sort_order: 0 },
    { id: 'uuid-b', sort_order: 1 },
  ]
})
```

---

### `accept_workspace_invite(p_workspace_id)`

Sets `accepted_at = now()` on the caller's pending workspace membership.

```ts
const { error } = await supabase.rpc('accept_workspace_invite', {
  p_workspace_id: workspaceId
})
// Throws if no pending invite exists
```

---

## Edge Functions

All Edge Functions are at `${SUPABASE_URL}/functions/v1/<name>`.
All require `Authorization: Bearer <jwt>` (except `reminder-webhook` which is internal).

### `GET /functions/v1/dashboard`

Returns aggregated data for the dashboard home screen.

```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/dashboard`, {
  headers: { Authorization: `Bearer ${jwt}` }
})
const data = await res.json()
```

**Response:**
```ts
{
  notes: {
    total: number
    pinned: number
    archived: number
    in_trash: number
  }
  tasks: {
    total: number
    completed: number
    due_today: number
    overdue: number
  }
  lists: Array<{
    id: string
    title: string
    icon: string | null
    color: string | null
    task_count: number
    completed_count: number
  }>
  recent_notes: Array<{
    id: string
    title: string
    content: string     // first 200 chars
    color: string | null
    updated_at: string
  }>
}
```

---

### `GET /functions/v1/search`

Filtered global search wrapping the `search_all` RPC.

```
GET /functions/v1/search?q=<query>&type=note|task&limit=20
```

```ts
const res = await fetch(
  `${SUPABASE_URL}/functions/v1/search?q=${encodeURIComponent(query)}&type=note&limit=20`,
  { headers: { Authorization: `Bearer ${jwt}` } }
)
const { results, count } = await res.json()
```

**Query params:**
| Param | Default | Description |
|---|---|---|
| `q` | required | Search query (min 1 char) |
| `type` | (all) | `note` or `task` to filter |
| `limit` | `20` | Max results (max 100) |

---

### `POST /functions/v1/export`

Queues a background export job. The job builds a ZIP of all the user's notes and tasks, uploads it to Storage, and emails a 7-day signed download link.

```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/export`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}` }
})
const data = await res.json()
// { scheduled: true, run_id: string }
// or { scheduled: false, reason: string } if TRIGGER_SECRET_KEY not set
```

**ZIP structure:**
```
export.zip
├── manifest.json
├── notes/
│   ├── meeting-notes.md
│   └── ideas.md
└── tasks/
    ├── inbox.json
    └── work.json
```

---

### `POST /functions/v1/reminder-cancel`

Cancels a pending reminder and removes it from the database.

```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/reminder-cancel`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ reminder_id: 'uuid' }),
})
// 200 { cancelled: true }
// 409 { error: "reminder already sent" }
// 404 { error: "reminder not found" }
```

---

### `POST /functions/v1/workspace-invite`

Invite a registered user to a workspace. Caller must be workspace owner or admin.

```ts
const res = await fetch(`${SUPABASE_URL}/functions/v1/workspace-invite`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ workspace_id: 'uuid', email: 'user@example.com' }),
})
// 201 { invited: true, user_id: string }
// 200 { already_member: true }
// 400 { error: "workspace_id and email are required" }
// 403 { error: "only workspace owners and admins can invite" }
// 404 { error: "no user found with that email" }
```

---

## Storage

### `note-attachments` bucket

Private bucket for note file attachments. Path: `{user_id}/{note_id}/{filename}`.

```ts
// Upload attachment
const { data, error } = await supabase.storage
  .from('note-attachments')
  .upload(`${userId}/${noteId}/photo.jpg`, file, { contentType: 'image/jpeg' })

// Create signed URL (valid for 5 minutes by default, up to 7 days)
const { data } = await supabase.storage
  .from('note-attachments')
  .createSignedUrl(`${userId}/${noteId}/photo.jpg`, 300)

// List files for a note
const { data: files } = await supabase.storage
  .from('note-attachments')
  .list(`${userId}/${noteId}`)

// Delete
await supabase.storage
  .from('note-attachments')
  .remove([`${userId}/${noteId}/photo.jpg`])
```

**Limits:** 5 MB per file · Allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown`

---

### `exports` bucket

Private bucket for ZIP exports. Files are uploaded by the background job and accessed via signed URL (emailed to the user). Users can also list their own exports:

```ts
const { data: files } = await supabase.storage
  .from('exports')
  .list(userId)
```

---

## Realtime Subscriptions

Subscribe to real-time changes on these tables:

```ts
// Subscribe to note changes
const channel = supabase
  .channel('notes-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'notes' },
    (payload) => {
      console.log('Note changed:', payload)
    }
  )
  .subscribe()

// Subscribe to task changes in a specific list
const channel = supabase
  .channel('tasks-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `list_id=eq.${listId}`,
    },
    (payload) => { /* handle */ }
  )
  .subscribe()

// Subscribe to workspace member changes (e.g. to detect when invite is accepted)
const channel = supabase
  .channel('workspace-members')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'workspace_members',
      filter: `workspace_id=eq.${workspaceId}`,
    },
    (payload) => { /* new member joined */ }
  )
  .subscribe()

// Always clean up
supabase.removeChannel(channel)
```

**Published tables:** `notes` · `tasks` · `todo_lists` · `workspace_members`

RLS is enforced at the subscription level — users only receive events for rows they can read.
