-- ─── Security & performance hardening (Supabase advisor) ──────────────────────
-- Addresses the actionable advisor lints:
--   • function_search_path_mutable — pin search_path on our 3 functions
--   • unindexed_foreign_keys       — add covering indexes for 10 FKs
--   • auth_rls_initplan            — wrap auth.uid()/auth.role() in (select …)
--                                    so they evaluate once per query, not per row
-- Policy bodies are recreated verbatim from the live definitions; only the
-- auth.* calls are wrapped, so RLS semantics are unchanged (verified by the test
-- suite). Deferred (separate follow-ups): consolidating multiple permissive
-- policies, and moving pg_trgm out of the public schema.

-- ── 1. Pin function search_path ──────────────────────────────────────────────
alter function public.set_updated_at()                 set search_path = '';
alter function public.protect_is_admin()               set search_path = '';
alter function public.accept_workspace_invite(uuid)    set search_path = '';

-- ── 1b. Recursion-proof workspace admin check ────────────────────────────────
-- The workspace_members insert/update/delete policies previously inlined a
-- self-referential `EXISTS (SELECT FROM workspace_members …)`. Wrapping
-- auth.uid() in a sub-select changes how the planner evaluates that and trips
-- RLS infinite-recursion (42P17). Route the owner/admin check through a
-- SECURITY DEFINER helper (which bypasses RLS, like is_workspace_member) so the
-- policy never re-enters the table.
create or replace function public.is_workspace_admin(wid uuid)
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
      and role in ('owner', 'admin')
      and accepted_at is not null
  );
$$;

-- ── 2. Covering indexes for foreign keys ─────────────────────────────────────
create index if not exists notes_workspace_id_idx              on public.notes(workspace_id);
create index if not exists todo_lists_workspace_id_idx         on public.todo_lists(workspace_id);
create index if not exists reminders_task_id_idx              on public.reminders(task_id);
create index if not exists reminders_note_id_idx              on public.reminders(note_id);
create index if not exists workspaces_owner_id_idx            on public.workspaces(owner_id);
create index if not exists workspace_members_invited_by_idx   on public.workspace_members(invited_by);
create index if not exists note_versions_user_id_idx          on public.note_versions(user_id);
create index if not exists note_comments_user_id_idx          on public.note_comments(user_id);
create index if not exists mentions_workspace_id_idx          on public.mentions(workspace_id);
create index if not exists mentions_mentioned_by_idx          on public.mentions(mentioned_by);

-- ── 3. Wrap auth.* in policies (auth_rls_initplan) ───────────────────────────

-- mentions
drop policy "mentions: member insert" on public.mentions;
create policy "mentions: member insert" on public.mentions for insert
  with check (((mentioned_by = (select auth.uid())) AND is_workspace_member(workspace_id)));

drop policy "mentions: recipient delete" on public.mentions;
create policy "mentions: recipient delete" on public.mentions for delete
  using ((mentioned_user = (select auth.uid())));

drop policy "mentions: recipient or author read" on public.mentions;
create policy "mentions: recipient or author read" on public.mentions for select
  using (((mentioned_user = (select auth.uid())) OR (mentioned_by = (select auth.uid()))));

drop policy "mentions: recipient update" on public.mentions;
create policy "mentions: recipient update" on public.mentions for update
  using ((mentioned_user = (select auth.uid())))
  with check ((mentioned_user = (select auth.uid())));

-- note_comments
drop policy "note_comments: author delete" on public.note_comments;
create policy "note_comments: author delete" on public.note_comments for delete
  using ((user_id = (select auth.uid())));

drop policy "note_comments: author update" on public.note_comments;
create policy "note_comments: author update" on public.note_comments for update
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

drop policy "note_comments: workspace member insert" on public.note_comments;
create policy "note_comments: workspace member insert" on public.note_comments for insert
  with check (((user_id = (select auth.uid())) AND (note_id IN ( SELECT notes.id
     FROM notes
    WHERE ((notes.workspace_id IS NOT NULL) AND is_workspace_member(notes.workspace_id))))));

drop policy "note_comments: workspace member read" on public.note_comments;
create policy "note_comments: workspace member read" on public.note_comments for select
  using ((note_id IN ( SELECT notes.id
     FROM notes
    WHERE ((notes.workspace_id IS NOT NULL) AND is_workspace_member(notes.workspace_id)))));

-- note_tags
drop policy "note_tags: owner full access" on public.note_tags;
create policy "note_tags: owner full access" on public.note_tags for all
  using ((note_id IN ( SELECT notes.id
     FROM notes
    WHERE (notes.user_id = (select auth.uid())))))
  with check (((note_id IN ( SELECT notes.id
     FROM notes
    WHERE (notes.user_id = (select auth.uid())))) AND (tag_id IN ( SELECT tags.id
     FROM tags
    WHERE (tags.user_id = (select auth.uid()))))));

-- note_versions
drop policy "Users can insert own note versions" on public.note_versions;
create policy "Users can insert own note versions" on public.note_versions for insert
  with check ((user_id = (select auth.uid())));

drop policy "Users can read own note versions" on public.note_versions;
create policy "Users can read own note versions" on public.note_versions for select
  using ((user_id = (select auth.uid())));

-- notes
drop policy "notes: owner full access" on public.notes;
create policy "notes: owner full access" on public.notes for all
  using (((user_id = (select auth.uid())) OR ((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id))))
  with check (((user_id = (select auth.uid())) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id))));

-- profiles
drop policy "profiles: owner can read own row" on public.profiles;
create policy "profiles: owner can read own row" on public.profiles for select
  using (((id = (select auth.uid())) OR (id IN ( SELECT wm2.user_id
     FROM (workspace_members wm1
       JOIN workspace_members wm2 ON ((wm1.workspace_id = wm2.workspace_id)))
    WHERE ((wm1.user_id = (select auth.uid())) AND (wm1.accepted_at IS NOT NULL) AND (wm2.accepted_at IS NOT NULL))))));

drop policy "profiles: owner can update own row" on public.profiles;
create policy "profiles: owner can update own row" on public.profiles for update
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

-- push_subscriptions
drop policy "Service role reads push subscriptions" on public.push_subscriptions;
create policy "Service role reads push subscriptions" on public.push_subscriptions for select
  using (((select auth.role()) = 'service_role'::text));

drop policy "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions for all
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- reminders
drop policy "reminders: owner delete" on public.reminders;
create policy "reminders: owner delete" on public.reminders for delete
  using ((user_id = (select auth.uid())));

drop policy "reminders: owner insert" on public.reminders;
create policy "reminders: owner insert" on public.reminders for insert
  with check (((user_id = (select auth.uid())) AND ((note_id IS NULL) OR (note_id IN ( SELECT notes.id
     FROM notes
    WHERE (notes.user_id = (select auth.uid()))))) AND ((task_id IS NULL) OR (task_id IN ( SELECT t.id
     FROM (tasks t
       JOIN todo_lists l ON ((l.id = t.list_id)))
    WHERE (l.user_id = (select auth.uid())))))));

drop policy "reminders: owner read/update/delete" on public.reminders;
create policy "reminders: owner read/update/delete" on public.reminders for select
  using ((user_id = (select auth.uid())));

drop policy "reminders: owner update" on public.reminders;
create policy "reminders: owner update" on public.reminders for update
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- tags
drop policy "tags: owner full access" on public.tags;
create policy "tags: owner full access" on public.tags for all
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- tasks
drop policy "tasks: owner via list" on public.tasks;
create policy "tasks: owner via list" on public.tasks for all
  using ((list_id IN ( SELECT todo_lists.id
     FROM todo_lists
    WHERE ((todo_lists.user_id = (select auth.uid())) OR ((todo_lists.workspace_id IS NOT NULL) AND is_workspace_member(todo_lists.workspace_id))))))
  with check ((list_id IN ( SELECT todo_lists.id
     FROM todo_lists
    WHERE ((todo_lists.user_id = (select auth.uid())) OR ((todo_lists.workspace_id IS NOT NULL) AND is_workspace_member(todo_lists.workspace_id))))));

-- todo_lists
drop policy "todo_lists: owner full access" on public.todo_lists;
create policy "todo_lists: owner full access" on public.todo_lists for all
  using (((user_id = (select auth.uid())) OR ((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id))))
  with check (((user_id = (select auth.uid())) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id))));

-- workspace_members (owner/admin checks via is_workspace_admin — no self-select)
drop policy "workspace_members: delete" on public.workspace_members;
create policy "workspace_members: delete" on public.workspace_members for delete
  using (((user_id = (select auth.uid())) OR is_workspace_admin(workspace_id)));

drop policy "workspace_members: owner/admin insert" on public.workspace_members;
create policy "workspace_members: owner/admin insert" on public.workspace_members for insert
  with check (is_workspace_admin(workspace_id));

drop policy "workspace_members: read" on public.workspace_members;
create policy "workspace_members: read" on public.workspace_members for select
  using (((user_id = (select auth.uid())) OR is_workspace_member(workspace_id)));

drop policy "workspace_members: update" on public.workspace_members;
create policy "workspace_members: update" on public.workspace_members for update
  using (((user_id = (select auth.uid())) OR is_workspace_admin(workspace_id)))
  with check (((user_id = (select auth.uid())) OR is_workspace_admin(workspace_id)));

-- workspaces
drop policy "workspaces: invited member read" on public.workspaces;
create policy "workspaces: invited member read" on public.workspaces for select
  using ((id IN ( SELECT workspace_members.workspace_id
     FROM workspace_members
    WHERE (workspace_members.user_id = (select auth.uid())))));

drop policy "workspaces: owner all" on public.workspaces;
create policy "workspaces: owner all" on public.workspaces for all
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));
