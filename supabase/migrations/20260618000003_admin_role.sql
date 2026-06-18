-- ─── Global admin role ────────────────────────────────────────────────────────
-- An app-operator flag, distinct from workspace roles. Powers the /admin
-- dashboard (aggregate metrics across all users). Granted out-of-band (SQL /
-- Studio / service role), never by users themselves.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ─── Prevent privilege escalation ─────────────────────────────────────────────
-- The "profiles: owner can update own row" RLS policy lets users update their
-- own profile (display_name, settings). Without this guard a user could also
-- flip their own is_admin. Revert any is_admin change that doesn't come from the
-- service role (migrations, Studio and the service-role key run as service_role
-- and are allowed through).

create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  -- Only guard against real end-user sessions. Migrations, the seed, Studio and
  -- the service-role key run with no end-user JWT (auth.uid() is null) and are
  -- allowed to set the flag.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger protect_profiles_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin();
