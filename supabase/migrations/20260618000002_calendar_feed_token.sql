-- ─── Calendar feed token lookup index ─────────────────────────────────────────
-- The calendar-feed Edge Function looks up a user by their per-user feed token
-- stored at profiles.settings.calendar_feed_token. Index that expression so the
-- (unauthenticated, service-role) lookup is a single index probe rather than a
-- full scan of profiles.

create index if not exists profiles_calendar_feed_token_idx
  on public.profiles ((settings ->> 'calendar_feed_token'))
  where settings ? 'calendar_feed_token';
