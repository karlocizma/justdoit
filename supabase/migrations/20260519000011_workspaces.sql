-- ─── workspaces ──────────────────────────────────────────────────────────────

create table public.workspaces (
  id          uuid         primary key default gen_random_uuid(),
  name        varchar(200) not null,
  owner_id    uuid         not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- ─── workspace_members ────────────────────────────────────────────────────────

create table public.workspace_members (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  role          varchar(20) not null default 'member'
                            check (role in ('owner', 'admin', 'member')),
  invited_by    uuid        references auth.users(id),
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);

-- ─── Add workspace_id to notes and todo_lists ─────────────────────────────────

alter table public.notes
  add column workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.todo_lists
  add column workspace_id uuid references public.workspaces(id) on delete set null;

-- ─── Helper: check accepted workspace membership ──────────────────────────────
-- SECURITY DEFINER so it can query workspace_members without triggering its RLS

create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = wid
      and user_id = auth.uid()
      and accepted_at is not null
  );
$$;

-- ─── Helper: expose realtime publication tables (for tests) ───────────────────

create or replace function public.get_realtime_tables()
returns text[]
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(array_agg(tablename::text order by tablename), '{}')
  from pg_publication_tables
  where pubname = 'supabase_realtime';
$$;

-- ─── Helper: look up user ID by email (for workspace invite) ──────────────────

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from auth.users where email = lower(p_email) limit 1;
$$;

-- ─── Trigger: auto-add workspace creator as owner member ─────────────────────

create or replace function public.on_workspace_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, invited_by, accepted_at)
  values (new.id, new.owner_id, 'owner', new.owner_id, now());
  return new;
end;
$$;

create trigger workspace_owner_membership
  after insert on public.workspaces
  for each row execute function public.on_workspace_created();

-- ─── RLS: workspaces ─────────────────────────────────────────────────────────

alter table public.workspaces enable row level security;

-- Owner has full CRUD on their own workspaces.
-- Using ALL (not separate INSERT) so PostgREST's RETURNING check passes:
-- the USING clause covers newly inserted rows before the member-read SELECT
-- policy's workspace_members subquery can see the owner's membership row.
create policy "workspaces: owner all"
  on public.workspaces for all
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Any invited member (pending or accepted) can read the workspace details
create policy "workspaces: invited member read"
  on public.workspaces for select
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- ─── RLS: workspace_members ───────────────────────────────────────────────────

alter table public.workspace_members enable row level security;

-- Own row (pending invites) OR accepted member sees all workspace members
create policy "workspace_members: read"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

-- Only owner/admin can invite new members (direct insert)
create policy "workspace_members: owner/admin insert"
  on public.workspace_members for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.accepted_at is not null
    )
  );

-- Members can accept their own invite; owner/admin can change others' roles
create policy "workspace_members: update"
  on public.workspace_members for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.accepted_at is not null
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.accepted_at is not null
    )
  );

-- Members can leave; owner/admin can remove others
create policy "workspace_members: delete"
  on public.workspace_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
        and wm.accepted_at is not null
    )
  );

-- ─── Update RLS: notes ────────────────────────────────────────────────────────

drop policy "notes: owner full access" on public.notes;

create policy "notes: owner full access"
  on public.notes for all
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    -- Creator must always be the authenticated user
    user_id = auth.uid()
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

-- ─── Update RLS: todo_lists ───────────────────────────────────────────────────

drop policy "todo_lists: owner full access" on public.todo_lists;

create policy "todo_lists: owner full access"
  on public.todo_lists for all
  using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or public.is_workspace_member(workspace_id)
    )
  );

-- ─── Update RLS: tasks (inherit workspace access from list) ──────────────────

drop policy "tasks: owner via list" on public.tasks;

create policy "tasks: owner via list"
  on public.tasks for all
  using (
    list_id in (
      select id from public.todo_lists
      where user_id = auth.uid()
        or (workspace_id is not null and public.is_workspace_member(workspace_id))
    )
  )
  with check (
    list_id in (
      select id from public.todo_lists
      where user_id = auth.uid()
        or (workspace_id is not null and public.is_workspace_member(workspace_id))
    )
  );

-- ─── Update RLS: profiles ─────────────────────────────────────────────────────
-- Members need to see co-members' display names for workspace UI

drop policy "profiles: owner can read own row" on public.profiles;

create policy "profiles: owner can read own row"
  on public.profiles for select
  using (
    id = auth.uid()
    or id in (
      select wm2.user_id
      from public.workspace_members wm1
      join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid()
        and wm1.accepted_at is not null
        and wm2.accepted_at is not null
    )
  );

-- ─── RPC: accept_workspace_invite ────────────────────────────────────────────

create or replace function public.accept_workspace_invite(p_workspace_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.workspace_members
  set accepted_at = now()
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and accepted_at is null;

  if not found then
    raise exception 'No pending invite found for workspace %', p_workspace_id;
  end if;
end;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────

do $$
declare
  tbl text;
  tables text[] := array['notes', 'tasks', 'todo_lists', 'workspace_members'];
begin
  foreach tbl in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end$$;
