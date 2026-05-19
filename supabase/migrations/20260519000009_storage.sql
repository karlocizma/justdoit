-- ─── Storage buckets ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-attachments',
  'note-attachments',
  false,
  5242880,   -- 5 MB
  array['image/jpeg','image/png','image/gif','image/webp',
        'application/pdf','text/plain','text/markdown']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('exports', 'exports', false, 104857600)  -- 100 MB
on conflict (id) do nothing;

-- ─── note-attachments RLS ─────────────────────────────────────────────────────
-- Path layout: note-attachments/{user_id}/{note_id}/{filename}
-- owner_id is set automatically to auth.uid()::text on upload.

create policy "note-attachments: owner select"
  on storage.objects for select
  using (
    bucket_id = 'note-attachments'
    and owner_id = auth.uid()::text
  );

create policy "note-attachments: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note-attachments: owner update"
  on storage.objects for update
  using (
    bucket_id = 'note-attachments'
    and owner_id = auth.uid()::text
  );

create policy "note-attachments: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'note-attachments'
    and owner_id = auth.uid()::text
  );

-- ─── exports RLS ─────────────────────────────────────────────────────────────
-- Path layout: exports/{user_id}/{job_id}.zip
-- Files are uploaded by the export Trigger.dev job (service role).
-- Users download via signed URL, which doesn't require RLS.
-- The SELECT policy lets users list their own exports if needed.

create policy "exports: owner select"
  on storage.objects for select
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
