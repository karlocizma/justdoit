-- Dev seed data — loaded after migrations on `supabase db reset`.
-- Uses Supabase's auth helper to create test users.

-- Test user credentials:
--   alice@example.com  /  password123
--   bob@example.com    /  password123

do $$
declare
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';

  list_work  uuid;
  list_inbox uuid;
  note1_id   uuid;
  tag_work   uuid;
  tag_ideas  uuid;
begin

  -- ── Users (inserted into auth.users directly for seeding) ──────────────────
  -- GoTrue (Go) scans all token/string fields as non-nullable — they must be ''
  -- not NULL, otherwise sign-in fails with "converting NULL to string".
  -- Email token fields must be '' (not NULL) — GoTrue scans them as non-nullable
  -- Go strings. Phone fields are left NULL — they have a UNIQUE constraint and
  -- GoTrue handles them as optional (*string).
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, instance_id, is_anonymous,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    reauthentication_token,
    created_at, updated_at, role, aud
  ) values
  (
    alice_id, 'alice@example.com',
    crypt('password123', gen_salt('bf')), now(),
    '{"full_name": "Alice"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid, false,
    '', '', '', '', '', '',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    bob_id, 'bob@example.com',
    crypt('password123', gen_salt('bf')), now(),
    '{"full_name": "Bob"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid, false,
    '', '', '', '', '', '',
    now(), now(), 'authenticated', 'authenticated'
  )
  on conflict (id) do nothing;

  -- profiles are created automatically via handle_new_user trigger,
  -- but trigger won't fire on direct insert — create manually for seeding.
  insert into public.profiles (id, display_name)
  values (alice_id, 'Alice'), (bob_id, 'Bob')
  on conflict (id) do nothing;

  -- ── Alice's tags ───────────────────────────────────────────────────────────
  insert into public.tags (id, user_id, name, color) values
    (gen_random_uuid(), alice_id, 'work',     '#6c63ff'),
    (gen_random_uuid(), alice_id, 'ideas',    '#48d1cc'),
    (gen_random_uuid(), alice_id, 'personal', '#4caf89');

  select id into tag_work  from public.tags where user_id = alice_id and name = 'work';
  select id into tag_ideas from public.tags where user_id = alice_id and name = 'ideas';

  -- ── Alice's notes ──────────────────────────────────────────────────────────
  insert into public.notes (id, user_id, title, content, is_pinned, sort_order)
  values
  (
    gen_random_uuid(), alice_id,
    'Welcome to JustDoIt',
    E'## Getting started\n\nThis is your first note. You can write **Markdown** here.\n\n- Create notes\n- Organise with tags\n- Pin important notes',
    true, 0
  ),
  (
    gen_random_uuid(), alice_id,
    'Backend architecture ideas',
    E'## Ideas\n\n- Edge Functions for aggregations\n- Trigger.dev for reminders\n- Supabase Realtime for live sync',
    false, 1
  );

  select id into note1_id from public.notes where user_id = alice_id and title = 'Backend architecture ideas';

  insert into public.note_tags (note_id, tag_id)
  values (note1_id, tag_work), (note1_id, tag_ideas)
  on conflict do nothing;

  -- ── Alice's to-do lists ────────────────────────────────────────────────────
  insert into public.todo_lists (id, user_id, title, icon, sort_order) values
  (gen_random_uuid(), alice_id, 'Inbox', '📥', 0),
  (gen_random_uuid(), alice_id, 'Work',  '💼', 1);

  select id into list_inbox from public.todo_lists where user_id = alice_id and title = 'Inbox';
  select id into list_work  from public.todo_lists where user_id = alice_id and title = 'Work';

  -- ── Alice's tasks ──────────────────────────────────────────────────────────
  insert into public.tasks (list_id, title, priority, due_date, sort_order) values
  (list_inbox, 'Set up Supabase project',      3, current_date,           0),
  (list_inbox, 'Write RLS policies',           2, current_date,           1),
  (list_inbox, 'Configure Trigger.dev',        2, current_date + 1,       2),
  (list_work,  'Review backend plan',          1, current_date,           0),
  (list_work,  'Design database schema',       3, current_date - 1, 1);

  -- ── Bob's data (minimal — to test RLS isolation) ───────────────────────────
  insert into public.todo_lists (user_id, title, sort_order)
  values (bob_id, 'My tasks', 0);

end $$;
