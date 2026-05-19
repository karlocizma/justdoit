# Frontend Integration Guide

This guide covers patterns for integrating the JustDoIt backend into a React/Next.js frontend using `@supabase/supabase-js` v2.

---

## Setup

```bash
npm install @supabase/supabase-js
```

Create a shared client module:

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../shared/database.types'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Copy `shared/database.types.ts` from this repo into the frontend — it gives full TypeScript types for every table, RPC, and function.

---

## Authentication

### Email/Password

```ts
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Sign out
await supabase.auth.signOut()
```

### GitHub / Google OAuth

```ts
await supabase.auth.signInWithOAuth({
  provider: 'github',  // or 'google'
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

Create a route at `/auth/callback` that calls:
```ts
// app/auth/callback/route.ts (Next.js App Router)
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }
  return Response.redirect(new URL('/dashboard', request.url))
}
```

### Session persistence

```ts
// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // session.user is available
  }
  if (event === 'SIGNED_OUT') {
    // redirect to login
  }
})

// Get current session
const { data: { session } } = await supabase.auth.getSession()
```

### Password reset

```ts
// Request reset email
await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: `${window.location.origin}/auth/reset-password`,
})

// Update password (from the reset page, after Supabase redirects back with token)
await supabase.auth.updateUser({ password: 'new-password' })
```

---

## Notes

### Fetch notes

```ts
const { data: notes, error } = await supabase
  .from('notes')
  .select('*, note_tags(tag:tags(*))')
  .eq('is_archived', false)
  .is('deleted_at', null)
  .order('is_pinned', { ascending: false })
  .order('sort_order')
```

### Create a note

```ts
const { data: note, error } = await supabase
  .from('notes')
  .insert({ title: 'New Note', content: '' })
  .select()
  .single()
```

### Update a note

```ts
await supabase
  .from('notes')
  .update({ title, content, color, is_pinned })
  .eq('id', noteId)
```

### Soft-delete a note

```ts
await supabase
  .from('notes')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', noteId)
```

### Add/remove tags

```ts
// Add tag to note
await supabase.from('note_tags').insert({ note_id: noteId, tag_id: tagId })

// Remove tag from note
await supabase.from('note_tags').delete().eq('note_id', noteId).eq('tag_id', tagId)
```

### Reorder notes (drag and drop)

```ts
await supabase.rpc('reorder_notes', {
  updates: [
    { id: 'uuid-1', sort_order: 0 },
    { id: 'uuid-2', sort_order: 1 },
    { id: 'uuid-3', sort_order: 2 },
  ]
})
```

---

## Tasks

### Fetch tasks for a list

```ts
const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('list_id', listId)
  .is('parent_id', null)          // top-level only
  .order('sort_order')
```

### Fetch with sub-tasks

```ts
const { data: tasks } = await supabase
  .from('tasks')
  .select('*, sub_tasks:tasks!parent_id(*)')
  .eq('list_id', listId)
  .is('parent_id', null)
  .order('sort_order')
```

### Toggle task complete

```ts
await supabase.rpc('toggle_task_complete', { task_id: taskId })
```

This handles recurring tasks automatically — if the task has a `recurrence`, it advances the `due_date` instead of marking it complete.

### Create task

```ts
const { data: task } = await supabase
  .from('tasks')
  .insert({
    list_id: listId,
    title: 'Buy groceries',
    due_date: '2026-05-20',
    priority: 2,           // 0=none 1=low 2=medium 3=high
    parent_id: null,       // set for sub-tasks
  })
  .select()
  .single()
```

### Recurring task

```ts
const { data: task } = await supabase
  .from('tasks')
  .insert({
    list_id: listId,
    title: 'Weekly review',
    due_date: '2026-05-20',
    recurrence: { freq: 'weekly', interval: 1 },  // freq: daily|weekly|monthly|yearly
  })
  .select()
  .single()
```

---

## Reminders

### Create a reminder

```ts
// On a task
await supabase.from('reminders').insert({
  task_id: taskId,
  remind_at: '2026-05-20T09:00:00Z',
  channel: 'in_app',  // 'in_app' | 'email' | 'push'
})

// On a note
await supabase.from('reminders').insert({
  note_id: noteId,
  remind_at: '2026-05-20T09:00:00Z',
  channel: 'email',
})
```

### Cancel a reminder

```ts
await fetch(`${SUPABASE_URL}/functions/v1/reminder-cancel`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ reminder_id: reminderId }),
})
```

---

## Dashboard

```ts
const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard`, {
  headers: { Authorization: `Bearer ${session.access_token}` },
})
const data = await response.json()
// {
//   pinned_notes: Note[],
//   today_tasks: Task[],
//   overdue_tasks: Task[],
//   stats: { total_notes, open_tasks, completed_today, lists_count }
// }
```

---

## Search

```ts
// Edge Function (filtered, with type and limit)
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/search?q=${encodeURIComponent(query)}&type=notes&limit=20`,
  { headers: { Authorization: `Bearer ${session.access_token}` } }
)
const { results } = await response.json()

// RPC (raw, all results)
const { data } = await supabase.rpc('search_all', { query: 'search term' })
```

---

## Storage (Note Attachments)

### Upload a file

```ts
const filePath = `${session.user.id}/${noteId}/${file.name}`

const { data, error } = await supabase.storage
  .from('note-attachments')
  .upload(filePath, file, { contentType: file.type })
```

Max file size: 5 MB. Allowed types: `image/*`, `application/pdf`, `text/plain`, `text/markdown`.

### Get a signed URL (for display/download)

```ts
const { data } = await supabase.storage
  .from('note-attachments')
  .createSignedUrl(filePath, 3600)  // expires in 1 hour

// data.signedUrl is a temporary download URL
```

### List attachments for a note

```ts
const { data: files } = await supabase.storage
  .from('note-attachments')
  .list(`${session.user.id}/${noteId}`)
```

### Delete an attachment

```ts
await supabase.storage
  .from('note-attachments')
  .remove([filePath])
```

---

## Export

```ts
// Queue an export — delivers a download link to the user's email
await fetch(`${SUPABASE_URL}/functions/v1/export`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}` },
})
// Returns 202 Accepted. The ZIP is generated async and emailed when ready.
```

---

## Workspaces

### Create a workspace

```ts
const { data: workspace } = await supabase
  .from('workspaces')
  .insert({ name: 'My Team' })
  .select()
  .single()
```

### Invite a member

```ts
await fetch(`${SUPABASE_URL}/functions/v1/workspace-invite`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    workspace_id: workspaceId,
    email: 'colleague@example.com',
    role: 'member',  // 'member' | 'admin'
  }),
})
```

### Accept an invite

```ts
await supabase.rpc('accept_workspace_invite', { p_workspace_id: workspaceId })
```

### Fetch workspace members

```ts
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, profile:profiles(display_name, avatar_url)')
  .eq('workspace_id', workspaceId)
```

### Create a workspace note

```ts
await supabase
  .from('notes')
  .insert({ title: 'Shared Note', workspace_id: workspaceId })
```

---

## Realtime Subscriptions

### Subscribe to notes changes

```ts
const channel = supabase
  .channel('notes-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'notes' },
    (payload) => {
      if (payload.eventType === 'INSERT') addNoteToState(payload.new)
      if (payload.eventType === 'UPDATE') updateNoteInState(payload.new)
      if (payload.eventType === 'DELETE') removeNoteFromState(payload.old.id)
    }
  )
  .subscribe()

// Cleanup
supabase.removeChannel(channel)
```

### Subscribe to tasks in a specific list

```ts
const channel = supabase
  .channel(`tasks-${listId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `list_id=eq.${listId}`,
    },
    (payload) => { /* handle change */ }
  )
  .subscribe()
```

### Subscribe to workspace member changes

```ts
const channel = supabase
  .channel(`workspace-${workspaceId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'workspace_members',
      filter: `workspace_id=eq.${workspaceId}`,
    },
    (payload) => { /* member joined / left / role changed */ }
  )
  .subscribe()
```

RLS is enforced on Realtime — users only receive events for rows they can read.

---

## Optimistic Updates Pattern

For responsive UI, update local state before the server confirms:

```ts
async function toggleTask(taskId: string) {
  // 1. Update local state immediately
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
  ))

  // 2. Call the server
  const { error } = await supabase.rpc('toggle_task_complete', { task_id: taskId })

  // 3. On error, revert
  if (error) {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
    ))
    showToast('Failed to update task', 'error')
  }
}
```

When Realtime is enabled, the confirmed server state will arrive via the subscription and overwrite the optimistic update automatically.

---

## User Profile

### Fetch own profile

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single()
```

### Update profile

```ts
await supabase
  .from('profiles')
  .update({
    display_name: 'Alice',
    settings: { digest_enabled: true },
  })
  .eq('id', session.user.id)
```

---

## Error Handling

Supabase client methods return `{ data, error }`. Always check `error`:

```ts
const { data, error } = await supabase.from('notes').select('*')
if (error) {
  console.error('Supabase error:', error.message, error.details)
  // Common codes:
  // PGRST301 — JWT expired (call supabase.auth.refreshSession())
  // 42501 — RLS violation (user doesn't have access)
  // 23505 — unique constraint violation
}
```

The client auto-refreshes the JWT session token, but on `PGRST301` you can explicitly force a refresh:

```ts
await supabase.auth.refreshSession()
```
