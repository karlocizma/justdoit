-- ─── push_subscriptions: drop redundant service-role SELECT policy ────────────
-- The owner "Users manage own push subscriptions" policy is FOR ALL, so it
-- already covers SELECT. The separate service-role SELECT policy overlaps it
-- (multiple_permissive_policies) and is redundant: service_role has BYPASSRLS,
-- so push-send reads every user's subscriptions regardless of policy. Drop it.

drop policy if exists "Service role reads push subscriptions" on public.push_subscriptions;
