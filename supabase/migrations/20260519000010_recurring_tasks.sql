-- ─── Update toggle_task_complete to handle recurring tasks ────────────────────
-- When completing a task that has a recurrence rule, instead of marking it done
-- we advance its due_date to the next occurrence and reset completion state.
-- This keeps a single task row (no history rows) — simple and predictable.
-- The returned row reflects the post-toggle state:
--   non-recurring → is_completed=true  (same as before)
--   recurring     → is_completed=false, due_date=next occurrence

create or replace function public.toggle_task_complete(task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  result     public.tasks;
  next_date  date;
  freq       text;
  interval_n int;
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

  -- For recurring tasks being completed: advance to next occurrence
  if result.is_completed
     and result.recurrence is not null
     and result.due_date   is not null
  then
    freq       := result.recurrence->>'freq';
    interval_n := coalesce((result.recurrence->>'interval')::int, 1);

    next_date := case freq
      when 'daily'   then result.due_date + (interval_n || ' days')::interval
      when 'weekly'  then result.due_date + (interval_n * 7 || ' days')::interval
      when 'monthly' then result.due_date + (interval_n || ' months')::interval
      when 'yearly'  then result.due_date + (interval_n || ' years')::interval
      else null
    end;

    -- If next occurrence is within the until limit (or no limit), advance
    if next_date is not null
       and (result.recurrence->>'until' is null
            or next_date <= (result.recurrence->>'until')::date)
    then
      update public.tasks
      set
        due_date     = next_date,
        is_completed = false,
        completed_at = null
      where id = task_id
      returning * into result;
    end if;
    -- If past until: leave it completed (natural end of recurrence)
  end if;

  return result;
end;
$$;
