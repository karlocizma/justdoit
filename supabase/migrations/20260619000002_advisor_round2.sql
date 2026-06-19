-- ─── Advisor round 2 ──────────────────────────────────────────────────────────
-- Clears the remaining high-count lints:
--   • Security: pg_trgm lives in `public`, dragging in ~31 extension functions
--     each flagged for mutable search_path, plus "extension in public". Move it
--     to the dedicated `extensions` schema (where pgcrypto/pg_net already live).
--   • Performance: `workspaces` has a FOR ALL policy overlapping a separate
--     SELECT policy (multiple_permissive_policies). Split into one policy per
--     command so no action has two permissive policies.

-- ── Move pg_trgm out of public ───────────────────────────────────────────────
-- Only usage in this schema is gin_trgm_ops indexes (notes/tasks title) + ILIKE.
-- Indexes reference the opclass by OID, so they keep working across the move;
-- ILIKE is a core operator, not a pg_trgm function. (Future trigram indexes must
-- qualify the opclass as extensions.gin_trgm_ops, or rely on the `extensions`
-- schema being in search_path.)
alter extension pg_trgm set schema extensions;

-- ── Consolidate workspaces policies ──────────────────────────────────────────
-- Replace "owner all" (ALL) + "invited member read" (SELECT) with one policy per
-- command. Owners keep full CRUD; accepted/invited members can read. The split
-- preserves PostgREST's insert-RETURNING (the SELECT policy allows owner_id =
-- self, so a freshly inserted workspace is readable back by its owner).
drop policy "workspaces: owner all" on public.workspaces;
drop policy "workspaces: invited member read" on public.workspaces;

create policy "workspaces: select" on public.workspaces for select
  using (
    (owner_id = (select auth.uid()))
    or (id in ( select workspace_members.workspace_id
                from public.workspace_members
                where workspace_members.user_id = (select auth.uid()) ))
  );

create policy "workspaces: insert" on public.workspaces for insert
  with check (owner_id = (select auth.uid()));

create policy "workspaces: update" on public.workspaces for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "workspaces: delete" on public.workspaces for delete
  using (owner_id = (select auth.uid()));
