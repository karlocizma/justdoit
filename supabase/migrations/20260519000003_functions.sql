-- ─── Auto-create profile on signup ───────────────────────────────────────────
-- Runs as SECURITY DEFINER so it can insert into public.profiles regardless
-- of RLS (the trigger fires before the user's session is established).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create trigger set_todo_lists_updated_at
  before update on public.todo_lists
  for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─── Complete a task (sets completed_at automatically) ────────────────────────
-- Called via RPC from the client instead of a raw PATCH to keep completion
-- logic in one place (and easily extendable for recurring task logic later).
create or replace function public.toggle_task_complete(task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.tasks;
begin
  update public.tasks t
  set
    is_completed = not t.is_completed,
    completed_at = case when not t.is_completed then now() else null end
  where
    t.id = task_id
    and t.list_id in (select id from public.todo_lists where user_id = auth.uid())
  returning * into result;

  if not found then
    raise exception 'task not found or access denied';
  end if;

  return result;
end;
$$;

-- ─── Bulk reorder helper ──────────────────────────────────────────────────────
-- Accepts an array of {id, sort_order} pairs and updates them in one call.
-- Works for notes, todo_lists, and tasks (table name passed as argument).
-- SECURITY: only updates rows owned by the current user (checked per-table).

create or replace function public.reorder_notes(
  updates jsonb  -- array of {"id": uuid, "sort_order": int}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(updates)
  loop
    update public.notes
    set sort_order = (item->>'sort_order')::int
    where id = (item->>'id')::uuid
      and user_id = auth.uid();
  end loop;
end;
$$;

create or replace function public.reorder_todo_lists(
  updates jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(updates)
  loop
    update public.todo_lists
    set sort_order = (item->>'sort_order')::int
    where id = (item->>'id')::uuid
      and user_id = auth.uid();
  end loop;
end;
$$;

create or replace function public.reorder_tasks(
  p_list_id uuid,
  updates   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  -- verify the list belongs to the caller
  if not exists (
    select 1 from public.todo_lists where id = p_list_id and user_id = auth.uid()
  ) then
    raise exception 'list not found or access denied';
  end if;

  for item in select * from jsonb_array_elements(updates)
  loop
    update public.tasks
    set sort_order = (item->>'sort_order')::int
    where id = (item->>'id')::uuid
      and list_id = p_list_id;
  end loop;
end;
$$;
