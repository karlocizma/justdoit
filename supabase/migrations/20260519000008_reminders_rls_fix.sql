-- Tighten the reminders INSERT/UPDATE policy so that users cannot create
-- reminders that point to notes or tasks owned by other users.
-- The USING clause (SELECT) stays as `user_id = auth.uid()` — a user can only
-- read their own reminder rows.  The WITH CHECK clause additionally validates
-- that the referenced note_id (if set) is owned by the caller, and that the
-- task_id (if set) is owned via the caller's list.

drop policy "reminders: owner full access" on public.reminders;

-- SELECT / UPDATE / DELETE: own rows only
create policy "reminders: owner read/update/delete"
  on public.reminders for select
  using (user_id = auth.uid());

create policy "reminders: owner update"
  on public.reminders for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reminders: owner delete"
  on public.reminders for delete
  using (user_id = auth.uid());

-- INSERT: user_id must be caller's, and referenced item must be caller's too
create policy "reminders: owner insert"
  on public.reminders for insert
  with check (
    user_id = auth.uid()
    and (
      note_id is null
      or note_id in (select id from public.notes where user_id = auth.uid())
    )
    and (
      task_id is null
      or task_id in (
        select t.id
        from   public.tasks t
        join   public.todo_lists l on l.id = t.list_id
        where  l.user_id = auth.uid()
      )
    )
  );
