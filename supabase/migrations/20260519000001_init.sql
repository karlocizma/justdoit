-- Extensions
create extension if not exists "pg_trgm";

-- ─── profiles (extends auth.users 1:1) ────────────────────────────────────────
create table public.profiles (
  id           uuid         primary key references auth.users(id) on delete cascade,
  display_name varchar(100) not null default '',
  avatar_url   text,
  settings     jsonb        not null default '{}',
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

comment on table public.profiles is 'Public user profile data extending auth.users.';

-- ─── tags ─────────────────────────────────────────────────────────────────────
create table public.tags (
  id      uuid        primary key default gen_random_uuid(),
  user_id uuid        not null references auth.users(id) on delete cascade,
  name    varchar(50) not null,
  color   varchar(20),
  unique (user_id, name)
);

-- ─── notes ────────────────────────────────────────────────────────────────────
create table public.notes (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references auth.users(id) on delete cascade,
  title       varchar(500) not null default '',
  content     text         not null default '',
  color       varchar(20),
  is_pinned   boolean      not null default false,
  is_archived boolean      not null default false,
  deleted_at  timestamptz,
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

comment on column public.notes.deleted_at is 'Soft delete — null means not deleted.';

-- ─── note_tags (junction) ─────────────────────────────────────────────────────
create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id  uuid not null references public.tags(id)  on delete cascade,
  primary key (note_id, tag_id)
);

-- ─── todo_lists ───────────────────────────────────────────────────────────────
create table public.todo_lists (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references auth.users(id) on delete cascade,
  title       varchar(200) not null,
  color       varchar(20),
  icon        varchar(50),
  is_archived boolean      not null default false,
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- ─── tasks ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id           uuid         primary key default gen_random_uuid(),
  list_id      uuid         not null references public.todo_lists(id) on delete cascade,
  parent_id    uuid         references public.tasks(id) on delete cascade,
  title        varchar(500) not null,
  notes        text,
  is_completed boolean      not null default false,
  completed_at timestamptz,
  due_date     date,
  due_time     time,
  priority     smallint     not null default 0 check (priority between 0 and 3),
  sort_order   integer      not null default 0,
  recurrence   jsonb,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

comment on column public.tasks.priority     is '0=none, 1=low, 2=medium, 3=high';
comment on column public.tasks.recurrence   is 'RRULE-like spec: { freq, interval, byweekday, until }';
comment on column public.tasks.parent_id    is 'Non-null for sub-tasks; max depth enforced in application.';

-- ─── reminders ────────────────────────────────────────────────────────────────
create table public.reminders (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  task_id         uuid        references public.tasks(id) on delete cascade,
  note_id         uuid        references public.notes(id) on delete cascade,
  remind_at       timestamptz not null,
  channel         varchar(20) not null default 'in_app'
                              check (channel in ('in_app', 'email', 'push')),
  is_sent         boolean     not null default false,
  trigger_job_id  text,
  created_at      timestamptz not null default now(),
  constraint reminders_target_check check (
    (task_id is not null)::int + (note_id is not null)::int = 1
  )
);

comment on column public.reminders.trigger_job_id is 'Trigger.dev job ID used to cancel a pending reminder.';
comment on constraint reminders_target_check on public.reminders
  is 'Exactly one of task_id or note_id must be set.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index notes_user_id_idx         on public.notes(user_id);
create index notes_user_active_idx     on public.notes(user_id, sort_order) where deleted_at is null;
create index notes_user_pinned_idx     on public.notes(user_id) where is_pinned = true and deleted_at is null;
create index notes_user_archived_idx   on public.notes(user_id) where is_archived = true and deleted_at is null;

create index tags_user_id_idx          on public.tags(user_id);

create index todo_lists_user_id_idx    on public.todo_lists(user_id);

create index tasks_list_id_idx         on public.tasks(list_id);
create index tasks_parent_id_idx       on public.tasks(parent_id) where parent_id is not null;
create index tasks_due_date_idx        on public.tasks(due_date)  where due_date is not null and is_completed = false;
create index tasks_completed_idx       on public.tasks(list_id, is_completed);

create index reminders_pending_idx     on public.reminders(user_id, remind_at) where is_sent = false;
