alter table tasks
  add column if not exists status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  add column if not exists assigned_to uuid references auth.users(id);

create index if not exists tasks_status_idx    on tasks (list_id, status);
create index if not exists tasks_assigned_idx  on tasks (assigned_to);
