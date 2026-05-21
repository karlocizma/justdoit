create table if not exists note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text not null,
  created_at timestamptz default now()
);

alter table note_versions enable row level security;

create policy "Users can read own note versions"
  on note_versions for select using (user_id = auth.uid());

create policy "Users can insert own note versions"
  on note_versions for insert with check (user_id = auth.uid());

create index note_versions_note_id_idx on note_versions (note_id, created_at desc);
