-- Row Level Security policies for all public tables.
-- auth.uid() returns the UUID of the authenticated user from the JWT.
-- All tables are locked — unauthenticated requests get zero rows.

-- ─── profiles ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles: owner can read own row"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: owner can update own row"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── notes ────────────────────────────────────────────────────────────────────
alter table public.notes enable row level security;

create policy "notes: owner full access"
  on public.notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── tags ─────────────────────────────────────────────────────────────────────
alter table public.tags enable row level security;

create policy "tags: owner full access"
  on public.tags for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── note_tags ────────────────────────────────────────────────────────────────
alter table public.note_tags enable row level security;

create policy "note_tags: owner full access"
  on public.note_tags for all
  using (
    note_id in (select id from public.notes where user_id = auth.uid())
  )
  with check (
    -- both note and tag must belong to the authenticated user
    note_id in (select id from public.notes where user_id = auth.uid())
    and
    tag_id  in (select id from public.tags  where user_id = auth.uid())
  );

-- ─── todo_lists ───────────────────────────────────────────────────────────────
alter table public.todo_lists enable row level security;

create policy "todo_lists: owner full access"
  on public.todo_lists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── tasks ────────────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;

create policy "tasks: owner via list"
  on public.tasks for all
  using (
    list_id in (select id from public.todo_lists where user_id = auth.uid())
  )
  with check (
    list_id in (select id from public.todo_lists where user_id = auth.uid())
  );

-- ─── reminders ────────────────────────────────────────────────────────────────
alter table public.reminders enable row level security;

create policy "reminders: owner full access"
  on public.reminders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
