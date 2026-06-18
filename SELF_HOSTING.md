# Self-Hosting JustDoIt

Run JustDoIt with no dependency on managed cloud services. Everything that runs
on the cloud deployment (Supabase, Trigger.dev, Resend, Vercel) has a
self-hosted equivalent.

For the managed free-tier path instead, see [`CLOUD_SETUP.md`](CLOUD_SETUP.md).

## Architecture

A self-hosted deployment is three stacks that talk over a shared Docker network:

| Stack | What it is | Source |
|---|---|---|
| **Supabase** | Postgres, Auth, PostgREST, Realtime, Storage, Edge Functions | official `supabase/docker` |
| **Trigger.dev** | background-job runner (reminders, digests, recurring, export) | official Trigger.dev self-host |
| **JustDoIt app** | the Next.js frontend | `self-hosting/docker-compose.yml` (this repo) |

The dev environment already runs the entire Supabase stack in Docker
(`supabase start`), so the backend is well-trodden ground — this guide is about
running it for production without the hosted services.

## Prerequisites

- Docker + Docker Compose
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations + functions)
- A domain (or hostnames) for the frontend and Supabase, ideally behind a TLS
  reverse proxy (Caddy/Traefik/nginx)

Create the shared network once:

```bash
docker network create justdoit
```

## 1 — Supabase backend

Follow Supabase's [self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
guide to bring up the stack. In short:

```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker /srv/supabase && cd /srv/supabase
cp .env.example .env
```

In that `.env`, generate and set **strong** values for `POSTGRES_PASSWORD`,
`JWT_SECRET`, and the derived `ANON_KEY` / `SERVICE_ROLE_KEY` (the Supabase guide
links a JWT generator), plus `SITE_URL` and `API_EXTERNAL_URL`. Attach the stack
to the shared network (add it under `networks:` in their compose, or set
`networks: [justdoit]`). Then `docker compose up -d`.

### Apply the schema

Point the CLI at your database and push all migrations:

```bash
# from this repo's root
supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"
```

### Deploy Edge Functions

```bash
supabase functions deploy --project-ref <self-hosted> \
  # or, for fully local: copy supabase/functions/* into the stack's functions volume
```

`config.toml` already marks the public functions (`reminder-webhook`,
`calendar-feed`) as `verify_jwt = false`, which the deploy respects. Set the
function secrets the app needs:

```bash
supabase secrets set \
  TRIGGER_SECRET_KEY=... TRIGGER_API_URL=https://trigger.example.com \
  SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... FROM_EMAIL=noreply@example.com \
  APP_URL=https://app.example.com \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com \
  ANTHROPIC_API_KEY=...   # optional
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into functions automatically.

## 2 — Background jobs (Trigger.dev, full parity)

Run a [self-hosted Trigger.dev](https://trigger.dev/docs/open-source/self-hosting)
instance (its own Docker compose). This keeps full parity — the job code in
`trigger/` runs unchanged. Then from this repo:

```bash
cd trigger
npm install
# Point the CLI at your instance, then deploy the jobs:
TRIGGER_API_URL=https://trigger.example.com npm run deploy
```

Set `TRIGGER_API_URL` as a Supabase **function secret** too (step 1) so
`auth-hook` enqueues jobs against your instance instead of the cloud — the
function reads it and falls back to `https://api.trigger.dev` if unset.

Set the job environment in your Trigger.dev instance: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `FROM_EMAIL`, and the email transport
(`SMTP_*` or `RESEND_API_KEY`).

## 3 — Email (no cloud)

The jobs and functions choose a transport from the environment:

1. `SMTP_HOST` set → **SMTP** (self-hosted or any SMTP server) — no cloud
2. else `RESEND_API_KEY` → Resend
3. else → email steps fail / are skipped (the app otherwise works)

For a no-cloud deployment, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_SECURE`, and `FROM_EMAIL` everywhere email is sent (Trigger.dev
job env **and** Supabase function secrets). Also configure GoTrue's own
[SMTP settings](https://supabase.com/docs/guides/self-hosting/docker#configuring-an-email-server)
in the Supabase `.env` so auth confirmation/reset emails send too.

## 4 — Frontend

```bash
cd self-hosting
cp .env.example .env      # fill in NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, etc.
docker compose --env-file .env up -d --build
```

This builds the Next.js standalone image (`web/Dockerfile`) and serves it on
`WEB_PORT` (default 3000). Put it behind your TLS reverse proxy. The frontend is
**server-rendered**, so it always runs as a Node server — there is no static
export. Offline support is unaffected: it comes from the app's own PWA service
worker.

## Networking

The browser must reach Supabase directly, so `NEXT_PUBLIC_SUPABASE_URL` is your
**public** Supabase URL (e.g. `https://supabase.example.com`), not an internal
Docker name. Server-to-server calls can use the internal name if all stacks
share the `justdoit` network.

## Known limitations

- **Workspace invite emails** are sent by the `workspace-invite` Edge Function
  via Resend only; without `RESEND_API_KEY` the email is skipped, but the invite
  still works — it appears in the invitee's **Settings → Workspaces** to accept.
  SMTP for this function (Deno) is a planned follow-up.
- **Code signing / TLS** are your responsibility (reverse proxy + certs).
- This guide has been assembled from the working dev stack and the official
  Supabase/Trigger.dev self-host docs; validate it end-to-end in a staging
  environment before relying on it.
