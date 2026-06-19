-- ─── Lock down function EXECUTE grants ────────────────────────────────────────
-- By default every function is EXECUTE-able by PUBLIC (and Supabase grants anon
-- + authenticated), which the advisor flags for SECURITY DEFINER functions
-- ("Public/Signed-In Users Can Execute SECURITY DEFINER Function" + the GraphQL
-- visibility lints). None of these are actually exploitable — the data RPCs all
-- scope to auth.uid() — but we tighten EXECUTE to least privilege.
--
-- Buckets:
--   • Internal / trigger functions → revoke from PUBLIC, anon, authenticated
--     (triggers fire regardless of grants; get_user_id_by_email is service-role
--     only and was an email-enumeration RPC).
--   • App RPCs the client calls as a signed-in user → revoke from PUBLIC, anon;
--     keep authenticated (+ service_role).
--   • is_workspace_member / is_workspace_admin → left as-is: RLS policies call
--     them, so the querying roles must retain EXECUTE.

-- ── Internal + trigger functions: no direct callers ──────────────────────────
revoke execute on function public.get_user_id_by_email(p_email text)  from public, anon, authenticated;
revoke execute on function public.handle_new_user()                   from public, anon, authenticated;
revoke execute on function public.on_workspace_created()              from public, anon, authenticated;
revoke execute on function public.notify_reminder_webhook()          from public, anon, authenticated;
revoke execute on function public.set_updated_at()                   from public, anon, authenticated;
revoke execute on function public.protect_is_admin()                 from public, anon, authenticated;

-- ── App RPCs: keep authenticated, drop anon/public ───────────────────────────
revoke execute on function public.toggle_task_complete(task_id uuid)         from public, anon;
revoke execute on function public.reorder_notes(updates jsonb)               from public, anon;
revoke execute on function public.reorder_tasks(p_list_id uuid, updates jsonb) from public, anon;
revoke execute on function public.reorder_todo_lists(updates jsonb)          from public, anon;
revoke execute on function public.search_all(query text)                     from public, anon;
revoke execute on function public.get_notes_by_tag(p_tag_id uuid)            from public, anon;
revoke execute on function public.get_notes_in_trash()                       from public, anon;
revoke execute on function public.restore_note(note_id uuid)                 from public, anon;
revoke execute on function public.accept_workspace_invite(p_workspace_id uuid) from public, anon;
revoke execute on function public.get_realtime_tables()                      from public, anon;
