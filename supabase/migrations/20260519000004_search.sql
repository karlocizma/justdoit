-- ─── Full-text search on notes ────────────────────────────────────────────────
-- Generated column: auto-updated whenever title or content changes.
-- Weight A = title (higher relevance), Weight B = content body.
alter table public.notes
  add column content_tsv tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(title,   '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) stored;

-- GIN index — fast for @@ queries
create index notes_content_tsv_idx on public.notes using gin(content_tsv);

-- ─── Trigram indexes for partial / prefix match ───────────────────────────────
-- Used in the search Edge Function for tasks (no tsvector there) and
-- for note title prefix search (e.g. "typ..." autocomplete).
create index notes_title_trgm_idx  on public.notes using gin(title  gin_trgm_ops);
create index tasks_title_trgm_idx  on public.tasks using gin(title  gin_trgm_ops);

-- ─── Search RPC ───────────────────────────────────────────────────────────────
-- Single function called by the /search Edge Function.
-- Returns a unified result set with a "kind" discriminator.
create or replace function public.search_all(query text)
returns table (
  kind       text,
  id         uuid,
  title      text,
  snippet    text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  -- Each branch wrapped in parens so ORDER BY + LIMIT works before UNION ALL
  (
    select
      'note'::text                                                   as kind,
      n.id,
      n.title,
      ts_headline('english', n.content, plainto_tsquery('english', query),
        'MaxWords=15, MinWords=5, StartSel=**, StopSel=**')         as snippet,
      n.updated_at
    from public.notes n
    where
      n.user_id    = auth.uid()
      and n.deleted_at is null
      and n.content_tsv @@ plainto_tsquery('english', query)
    order by ts_rank(n.content_tsv, plainto_tsquery('english', query)) desc
    limit 20
  )

  union all

  (
    select
      'task'::text    as kind,
      t.id,
      t.title,
      null::text      as snippet,
      t.updated_at
    from public.tasks t
    join public.todo_lists l on l.id = t.list_id
    where
      l.user_id = auth.uid()
      and t.title ilike '%' || query || '%'
    order by t.updated_at desc
    limit 20
  );
$$;
