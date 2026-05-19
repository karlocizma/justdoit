-- Add DEFAULT auth.uid() to every user_id column that clients write directly.
-- This lets PostgREST clients omit user_id on INSERT — the DB fills it in from
-- the JWT, and the existing RLS WITH CHECK ensures the value is valid.

alter table public.notes
  alter column user_id set default auth.uid();

alter table public.tags
  alter column user_id set default auth.uid();

alter table public.todo_lists
  alter column user_id set default auth.uid();

alter table public.reminders
  alter column user_id set default auth.uid();
