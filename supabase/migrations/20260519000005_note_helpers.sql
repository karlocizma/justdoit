-- ─── get_notes_by_tag ─────────────────────────────────────────────────────────
-- Returns all active, non-archived notes for the current user that carry a
-- specific tag. Used instead of PostgREST embedded-resource filtering because
-- the INNER JOIN approach produces duplicate rows when a note has multiple tags.
create or replace function public.get_notes_by_tag(p_tag_id uuid)
returns setof public.notes
language sql
security definer
set search_path = public
stable
as $$
  select n.*
  from public.notes n
  inner join public.note_tags nt on nt.note_id = n.id
  where nt.tag_id   = p_tag_id
    and n.user_id   = auth.uid()
    and n.deleted_at is null
  order by n.is_pinned desc, n.sort_order asc;
$$;

-- ─── get_notes_in_trash ───────────────────────────────────────────────────────
-- Returns soft-deleted notes so the UI can show a recoverable trash view.
create or replace function public.get_notes_in_trash()
returns setof public.notes
language sql
security definer
set search_path = public
stable
as $$
  select * from public.notes
  where user_id    = auth.uid()
    and deleted_at is not null
  order by deleted_at desc;
$$;

-- ─── restore_note ─────────────────────────────────────────────────────────────
-- Clears deleted_at so the note reappears in the active list.
create or replace function public.restore_note(note_id uuid)
returns public.notes
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.notes;
begin
  update public.notes
  set deleted_at = null
  where id       = note_id
    and user_id  = auth.uid()
  returning * into result;

  if not found then
    raise exception 'note not found or access denied';
  end if;

  return result;
end;
$$;
