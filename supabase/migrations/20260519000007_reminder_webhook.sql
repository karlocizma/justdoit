-- ─── DB trigger → Edge Function when a reminder is created ──────────────────
-- Uses pg_net (pre-installed in Supabase) to fire an async HTTP POST to the
-- reminder-webhook Edge Function.  The URL falls back to the Docker-internal
-- Kong address for local dev; in production set app.edge_function_url via
-- ALTER DATABASE.

create or replace function public.notify_reminder_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  secret   text;
begin
  base_url := coalesce(
    nullif(current_setting('app.edge_function_url', true), ''),
    'http://supabase_kong_justdoit:8000'
  );
  secret := coalesce(current_setting('app.webhook_secret', true), '');

  perform net.http_post(
    url     := base_url || '/functions/v1/reminder-webhook',
    body    := jsonb_build_object(
                 'type',       tg_op,
                 'table',      tg_table_name,
                 'schema',     tg_table_schema,
                 'record',     to_jsonb(new),
                 'old_record', null
               ),
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-webhook-secret', secret
               )
  );

  return new;
end;
$$;

create trigger on_reminder_insert
  after insert on public.reminders
  for each row
  execute function public.notify_reminder_webhook();
