# Deployment Guide

## Overview

JustDoIt runs on three external services:

| Service | What it hosts | Cost |
|---|---|---|
| Supabase Cloud | Database, Auth, PostgREST, Realtime, Storage, Edge Functions | Free tier available |
| Trigger.dev | Background jobs (reminders, recurring tasks, digest, export) | Free tier available |
| Resend | Transactional email | Free tier: 3,000 emails/mo |

---

## 1. Supabase Project

### Create project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your users
3. Set a strong database password (save it — you'll need it for `db push`)

### Push schema

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

`db push` applies every migration in `supabase/migrations/` to the remote database. It's idempotent for already-applied migrations.

### Deploy Edge Functions

```bash
supabase functions deploy dashboard
supabase functions deploy search
supabase functions deploy export
supabase functions deploy reminder-webhook
supabase functions deploy reminder-cancel
supabase functions deploy workspace-invite
```

Or deploy all at once:
```bash
supabase functions deploy
```

### Set Edge Function secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_live_xxx \
  TRIGGER_SECRET_KEY=tr_prod_xxx \
  FROM_EMAIL=noreply@yourdomain.com \
  APP_URL=https://yourdomain.com
```

Verify secrets are set:
```bash
supabase secrets list
```

### Configure Auth

In the Supabase dashboard → Authentication → URL Configuration:

- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** Add `https://yourdomain.com/**`

For OAuth providers (GitHub, Google):

**GitHub OAuth:**
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID and Secret into Supabase → Auth → Providers → GitHub

**Google OAuth:**
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID and Secret into Supabase → Auth → Providers → Google

### Auth email templates

Custom HTML templates are in `supabase/templates/`. Upload them in the Supabase dashboard → Auth → Email Templates, or configure Resend as the SMTP provider to use them automatically.

---

## 2. Trigger.dev

### Create project

1. Go to [trigger.dev](https://trigger.dev) → New Project
2. Copy the project ref and API key

### Deploy jobs

```bash
cd trigger
npm run deploy
```

This deploys all jobs in `trigger/jobs/`:
- `reminder.ts` — timed reminder delivery (scheduled via Trigger.dev's `wait.until`)
- `recurring-tasks.ts` — daily cron: advances overdue recurring tasks
- `email-digest.ts` — daily cron: sends task digest to users with `digest_enabled: true`
- `export.ts` — on-demand: generates ZIP export and emails a signed download URL

### Environment variables for Trigger jobs

In the Trigger.dev dashboard → Project → Environment Variables, set:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
RESEND_API_KEY=re_live_xxx
FROM_EMAIL=noreply@yourdomain.com
APP_URL=https://yourdomain.com
```

### Connecting to Supabase Edge Functions

The `reminder-webhook` Edge Function is called by the database trigger when a reminder is created. It calls `Trigger.dev` to schedule the reminder delivery. Set `TRIGGER_SECRET_KEY` as a Supabase secret (see above).

---

## 3. Resend

1. Go to [resend.com](https://resend.com) → Create API key
2. Add and verify your sending domain (DNS TXT + MX records)
3. Update `FROM_EMAIL` in Supabase secrets and Trigger.dev env vars

Emails sent by this app:
- Auth: email confirmation, password reset (via Supabase Auth SMTP config or auth-hook Edge Function)
- Reminders: reminder delivery (via `reminder.ts` Trigger job)
- Digest: daily task summary (via `email-digest.ts` Trigger job)
- Export: download link for ZIP exports (via `export.ts` Trigger job)

---

## 4. Frontend

The frontend lives in the `web/` directory. Deploy it to Vercel:

```bash
cd web
vercel
```

Set the following environment variables in the Vercel project dashboard (or via `vercel env add`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

The anon key is safe to expose publicly — RLS enforces all access controls server-side.

Alternatively, deploy manually:

```bash
cd web
npm run build
npm run start   # serves on port 3000
```

---

## Environment Variables Reference

| Variable | Where set | Required | Description |
|---|---|---|---|
| `SUPABASE_URL` | Supabase secrets + Trigger env | Yes | Project URL |
| `SUPABASE_ANON_KEY` | Frontend `.env` | Yes | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets + Trigger env | Yes | Server-side only, never expose |
| `TRIGGER_SECRET_KEY` | Supabase secrets | For reminders/export | Trigger.dev API key |
| `RESEND_API_KEY` | Supabase secrets + Trigger env | For email | Resend API key |
| `FROM_EMAIL` | Supabase secrets + Trigger env | No | Defaults to `noreply@justdoit.app` |
| `APP_URL` | Supabase secrets + Trigger env | No | Defaults to `https://justdoit.app` |

---

## Production Checklist

- [ ] Supabase project created, region selected
- [ ] `supabase db push` succeeded (check migration list in dashboard)
- [ ] All 6 Edge Functions deployed
- [ ] `RESEND_API_KEY` and `TRIGGER_SECRET_KEY` set as Supabase secrets
- [ ] Supabase Auth Site URL and Redirect URLs configured
- [ ] GitHub and/or Google OAuth apps created with correct callback URLs
- [ ] Auth email templates uploaded (or Resend SMTP configured)
- [ ] Trigger.dev project created, jobs deployed
- [ ] Trigger.dev environment variables set (Supabase URL + service key + Resend)
- [ ] Resend domain verified, `FROM_EMAIL` updated
- [ ] Frontend (`web/`) deployed to Vercel with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] End-to-end smoke test: sign up, create note, create task, check reminder

---

## Monitoring

- **Supabase logs:** Dashboard → Logs → API / Postgres / Edge Functions
- **Trigger.dev runs:** Dashboard → Runs (shows job history, errors, retries)
- **Resend delivery:** Dashboard → Emails (delivery status, bounces)
- **Realtime:** Supabase Dashboard → Realtime → Inspector (live event stream)
