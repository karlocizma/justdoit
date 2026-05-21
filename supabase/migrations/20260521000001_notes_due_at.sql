-- Add due date to notes (appears in calendar view and daily digest)
alter table notes add column if not exists due_at timestamptz;

create index if not exists notes_due_at_idx on notes (user_id, due_at)
  where due_at is not null and deleted_at is null;
