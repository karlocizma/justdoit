-- ─── note_comments ────────────────────────────────────────────────────────────
-- Discussion threads on notes inside a workspace. Comments are only allowed on
-- notes that belong to a workspace; access is gated on accepted membership of
-- that workspace (reusing public.is_workspace_member).

create table public.note_comments (
  id          uuid        primary key default gen_random_uuid(),
  note_id     uuid        not null references public.notes(id) on delete cascade,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  content     text        not null check (char_length(content) between 1 and 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index note_comments_note_id_idx on public.note_comments (note_id, created_at);

-- ─── Trigger: auto-update updated_at ──────────────────────────────────────────

create trigger set_note_comments_updated_at
  before update on public.note_comments
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.note_comments enable row level security;

-- A comment is visible to anyone who can see its parent note AND that note is a
-- workspace note the user is an accepted member of. Personal (non-workspace)
-- notes get no comment threads.
create policy "note_comments: workspace member read"
  on public.note_comments for select
  using (
    note_id in (
      select id from public.notes
      where workspace_id is not null
        and public.is_workspace_member(workspace_id)
    )
  );

-- Members of the note's workspace can add comments; author must be the caller.
create policy "note_comments: workspace member insert"
  on public.note_comments for insert
  with check (
    user_id = auth.uid()
    and note_id in (
      select id from public.notes
      where workspace_id is not null
        and public.is_workspace_member(workspace_id)
    )
  );

-- Authors can edit their own comments.
create policy "note_comments: author update"
  on public.note_comments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Authors can delete their own comments.
create policy "note_comments: author delete"
  on public.note_comments for delete
  using (user_id = auth.uid());

-- ─── Realtime ─────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'note_comments'
  ) then
    alter publication supabase_realtime add table public.note_comments;
  end if;
end$$;
