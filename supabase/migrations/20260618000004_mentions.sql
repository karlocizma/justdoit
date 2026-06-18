-- ─── mentions ─────────────────────────────────────────────────────────────────
-- @-mentions of workspace members in note content or task titles. One row per
-- (source, mentioned user) — re-editing the source never re-notifies, thanks to
-- the unique constraint. Powers the in-app notifications bell.

create table public.mentions (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  mentioned_user uuid        not null references auth.users(id) on delete cascade,
  mentioned_by   uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  source_type    text        not null check (source_type in ('note', 'task')),
  source_id      uuid        not null,
  context        text,
  is_read        boolean     not null default false,
  created_at     timestamptz not null default now(),
  unique (source_id, mentioned_user)
);

create index mentions_recipient_idx on public.mentions (mentioned_user, is_read, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.mentions enable row level security;

-- You can read mentions addressed to you, or ones you created (so the author's
-- insert ... returning works and push can target only newly-created rows).
-- The notifications UI filters to mentioned_user = self explicitly.
create policy "mentions: recipient or author read"
  on public.mentions for select
  using (mentioned_user = auth.uid() or mentioned_by = auth.uid());

-- A workspace member can create mentions (as themselves) within that workspace.
create policy "mentions: member insert"
  on public.mentions for insert
  with check (
    mentioned_by = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

-- The recipient can update their own mentions (mark read).
create policy "mentions: recipient update"
  on public.mentions for update
  using (mentioned_user = auth.uid())
  with check (mentioned_user = auth.uid());

-- The recipient can dismiss/delete their own mentions.
create policy "mentions: recipient delete"
  on public.mentions for delete
  using (mentioned_user = auth.uid());

-- ─── Realtime ─────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mentions'
  ) then
    alter publication supabase_realtime add table public.mentions;
  end if;
end$$;
