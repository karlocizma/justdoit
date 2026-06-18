# Database Schema

PostgreSQL 17. All tables live in the `public` schema. Row Level Security is enabled on every table — unauthenticated requests receive zero rows, and users can only see their own data (or workspace-shared data they've been invited to).

---

## Entity Relationship Diagram

```
auth.users (Supabase managed)
   │
   ├─── profiles (1:1)
   │
   ├─── notes ──────── note_tags ──── tags
   │       │
   │       └── reminders
   │
   ├─── todo_lists ─── tasks (self-referential via parent_id for sub-tasks)
   │       │               │
   │       │               └── reminders
   │       │
   │       └── (workspace_id FK)
   │
   └─── workspaces ─── workspace_members
           │
           └── (notes.workspace_id FK)
               (todo_lists.workspace_id FK)
```

---

## Tables

### `profiles`

One row per user, created automatically by trigger `on_auth_user_created`.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | | References `auth.users(id)` |
| `display_name` | varchar(100) | `''` | User's display name |
| `avatar_url` | text? | | URL to avatar image |
| `settings` | jsonb | `{}` | User preferences. Known keys: `digest_enabled`, `anthropic_api_key`, `calendar_feed_token` |
| `is_admin` | boolean | `false` | Global app-operator flag (powers `/admin`). Granted out-of-band; a `before update` trigger blocks end-users from self-escalating it |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | Auto-updated by trigger |

---

### `notes`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `user_id` | uuid | `auth.uid()` | Owner |
| `workspace_id` | uuid? | `null` | Workspace (null = personal note) |
| `title` | varchar(500) | `''` | |
| `content` | text | `''` | Markdown body |
| `content_tsv` | tsvector | computed | Full-text search vector (auto-updated by trigger) |
| `color` | varchar(20)? | | Hex color for visual accent |
| `is_pinned` | boolean | `false` | Pinned notes appear first |
| `is_archived` | boolean | `false` | |
| `deleted_at` | timestamptz? | `null` | Soft delete. Null = active |
| `sort_order` | integer | `0` | Display order |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | Auto-updated by trigger |

**Indexes:** `(user_id, sort_order) WHERE deleted_at IS NULL` · `(user_id) WHERE is_pinned AND deleted_at IS NULL` · `content_tsv` GIN

---

### `tags`

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | Owner (`auth.uid()`) |
| `name` | varchar(50) | Unique per user |
| `color` | varchar(20)? | Hex color |

**Constraint:** `UNIQUE (user_id, name)`

---

### `note_tags`

Junction table.

| Column | Type | Description |
|---|---|---|
| `note_id` | uuid | FK → `notes(id)` CASCADE |
| `tag_id` | uuid | FK → `tags(id)` CASCADE |

**PK:** `(note_id, tag_id)`

---

### `todo_lists`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `user_id` | uuid | `auth.uid()` | Creator/owner |
| `workspace_id` | uuid? | `null` | Workspace (null = personal) |
| `title` | varchar(200) | | |
| `color` | varchar(20)? | | Hex accent |
| `icon` | varchar(50)? | | Emoji or icon identifier |
| `is_archived` | boolean | `false` | |
| `sort_order` | integer | `0` | Sidebar position |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | Auto-updated |

---

### `tasks`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `list_id` | uuid | | FK → `todo_lists(id)` CASCADE |
| `parent_id` | uuid? | `null` | FK → `tasks(id)` CASCADE (sub-tasks) |
| `title` | varchar(500) | | |
| `notes` | text? | | Additional notes / description |
| `is_completed` | boolean | `false` | |
| `completed_at` | timestamptz? | | Set by `toggle_task_complete` |
| `due_date` | date? | | |
| `due_time` | time? | | |
| `priority` | smallint | `0` | `0`=none `1`=low `2`=medium `3`=high |
| `sort_order` | integer | `0` | Position within list |
| `recurrence` | jsonb? | `null` | `{ freq, interval?, until? }` |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | Auto-updated |

**Recurrence `freq` values:** `daily` · `weekly` · `monthly` · `yearly`

**Note on sub-tasks:** `parent_id` creates a two-level hierarchy. Sub-tasks do not support further nesting (enforced at application level).

---

### `reminders`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `user_id` | uuid | `auth.uid()` | Owner |
| `task_id` | uuid? | | FK → `tasks(id)` CASCADE |
| `note_id` | uuid? | | FK → `notes(id)` CASCADE |
| `remind_at` | timestamptz | | When to fire the reminder |
| `channel` | varchar(20) | `'in_app'` | `'email'` \| `'in_app'` \| `'push'` |
| `is_sent` | boolean | `false` | Set by Trigger.dev job after delivery |
| `trigger_job_id` | text? | | Trigger.dev run ID (for cancellation) |
| `created_at` | timestamptz | `now()` | |

**Constraint:** Exactly one of `task_id` or `note_id` must be non-null.

---

### `workspaces`

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | varchar(200) | | |
| `owner_id` | uuid | `auth.uid()` | FK → `auth.users(id)` |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | |

On INSERT, a trigger auto-creates a `workspace_members` row for the owner with `role = 'owner'` and `accepted_at = now()`.

---

### `workspace_members`

| Column | Type | Default | Description |
|---|---|---|---|
| `workspace_id` | uuid | | FK → `workspaces(id)` CASCADE |
| `user_id` | uuid | | FK → `auth.users(id)` CASCADE |
| `role` | varchar(20) | `'member'` | `'owner'` \| `'admin'` \| `'member'` |
| `invited_by` | uuid? | | FK → `auth.users(id)` |
| `invited_at` | timestamptz | `now()` | |
| `accepted_at` | timestamptz? | `null` | Null = pending invite |

**PK:** `(workspace_id, user_id)`

---

### `note_comments`

Discussion threads on workspace notes. Only notes that belong to a workspace can have comments.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `note_id` | uuid | | FK → `notes(id)` CASCADE |
| `user_id` | uuid | `auth.uid()` | FK → `auth.users(id)` CASCADE (comment author) |
| `content` | text | | 1–4000 chars (check constraint) |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | Bumped by `set_updated_at()` trigger |

**Index:** `(note_id, created_at)` for ordered thread fetches.

---

## Row Level Security Summary

| Table | Who can SELECT | Who can INSERT | Who can UPDATE | Who can DELETE |
|---|---|---|---|---|
| `profiles` | Own row + co-workspace-members | (trigger only) | Own row | – |
| `notes` | Own + workspace member | Own + workspace member | Own + workspace member | Own + workspace member |
| `tags` | Own | Own | Own | Own |
| `note_tags` | Own notes/tags | Own notes/tags | – | Own notes/tags |
| `todo_lists` | Own + workspace member | Own + workspace member | Own + workspace member | Own + workspace member |
| `tasks` | Via list ownership | Via list ownership | Via list ownership | Via list ownership |
| `reminders` | Own | Own (with ownership check on note/task) | Own | Own |
| `workspaces` | Owner + invited members | Owner (new workspace) | Owner | Owner |
| `workspace_members` | Own row + workspace members | Owner/admin | Self (accept) + owner/admin | Self (leave) + owner/admin |
| `note_comments` | Member of note's workspace | Member of note's workspace (self as author) | Author only | Author only |

---

## Key Functions & Triggers

| Name | Type | Description |
|---|---|---|
| `handle_new_user()` | Trigger fn | Creates `profiles` row on `auth.users` INSERT |
| `set_updated_at()` | Trigger fn | Updates `updated_at` on row change |
| `protect_is_admin()` | Trigger fn | Reverts `profiles.is_admin` changes from end-user sessions (anti-escalation) |
| `on_workspace_created()` | Trigger fn | Auto-adds workspace creator as owner member |
| `toggle_task_complete(task_id)` | RPC | Toggle completion, advance date for recurring tasks |
| `reorder_notes(updates)` | RPC | Bulk update `sort_order` on notes |
| `reorder_todo_lists(updates)` | RPC | Bulk update `sort_order` on lists |
| `reorder_tasks(list_id, updates)` | RPC | Bulk update `sort_order` on tasks |
| `search_all(query)` | RPC | Trigram full-text search across notes + tasks |
| `get_notes_by_tag(tag_name)` | RPC | Notes matching a tag name |
| `accept_workspace_invite(workspace_id)` | RPC | Accept pending workspace invite |
| `is_workspace_member(workspace_id)` | Helper | Returns boolean (SECURITY DEFINER, used in RLS) |

---

## Storage Buckets

| Bucket | Public | Max file size | Allowed MIME types |
|---|---|---|---|
| `note-attachments` | No | 5 MB | `image/*`, `application/pdf`, `text/plain`, `text/markdown` |
| `exports` | No | 100 MB | `application/zip` |

Storage paths:
- `note-attachments/{user_id}/{note_id}/{filename}`
- `exports/{user_id}/{run_id}.zip`

---

## Realtime Publication

The `supabase_realtime` publication includes: `notes` · `tasks` · `todo_lists` · `workspace_members` · `note_comments`

RLS is enforced on realtime events — users only receive change notifications for rows they can read.
