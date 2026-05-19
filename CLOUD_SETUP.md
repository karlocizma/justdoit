# Cloud Setup Guide

Everything runs on free tiers. You need four accounts: **Supabase**, **Trigger.dev**, **Resend**, and **Vercel** (for the frontend). Total setup time: ~45 minutes.

---

## 1. Supabase — database, auth, API, storage, edge functions

**Sign up:** [supabase.com](https://supabase.com)

### 1.1 Create a project
- Click **New project**
- Choose a name and a region close to your users
- Set a strong database password (save it — you'll need it)
- Wait ~2 minutes for provisioning

### 1.2 Get your keys
Go to **Project Settings → API**. You need:
- `Project URL` → this is your `SUPABASE_URL`
- `anon / public` key → this is your `SUPABASE_ANON_KEY` (safe for frontend)
- `service_role / secret` key → this is your `SUPABASE_SERVICE_ROLE_KEY` (never expose to browser)

Copy these into a safe place.

### 1.3 Push the database schema
In this repo, run:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The project ref is the short ID in your Supabase project URL: `https://supabase.com/dashboard/project/<ref>`.

After `db push` succeeds, go to **Table Editor** in the dashboard — you should see all tables: `profiles`, `notes`, `tags`, `todo_lists`, `tasks`, `reminders`, `workspaces`, `workspace_members`.

### 1.4 Deploy edge functions
```bash
supabase functions deploy
```

This deploys all 6 functions: `dashboard`, `search`, `export`, `reminder-webhook`, `reminder-cancel`, `workspace-invite`.

Verify in the dashboard: **Edge Functions** — all 6 should be listed.

### 1.5 Set secrets (skip Trigger + Resend for now, come back after steps 2 and 3)
```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxx \
  TRIGGER_SECRET_KEY=tr_xxxx \
  FROM_EMAIL=noreply@yourdomain.com \
  APP_URL=https://yourdomain.com
```

You can run this again any time to update a value.

### 1.6 Configure authentication
Go to **Authentication → URL Configuration**:
- **Site URL:** `https://yourdomain.com` (your frontend URL)
- **Redirect URLs:** add `https://yourdomain.com/**`

#### GitHub OAuth (optional)
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `https://yourdomain.com`
3. Authorization callback URL: `https://<ref>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Secret
5. Supabase dashboard → **Authentication → Providers → GitHub** → enable and paste

#### Google OAuth (optional)
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Application type: Web application
3. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret
5. Supabase dashboard → **Authentication → Providers → Google** → enable and paste

> **⚠️ Supabase free tier pause:** Projects auto-pause after 7 days of inactivity. Go to the dashboard and click **Restore** to wake it up (~2 min). Use the project daily to avoid pausing, or upgrade to Pro ($25/mo) to disable it.

---

## 2. Trigger.dev — background jobs (reminders, recurring tasks, digest, export)

**Sign up:** [trigger.dev](https://trigger.dev)

### 2.1 Create a project
- Click **New project**, give it a name (e.g. `justdoit`)
- Go to **Project Settings** and copy the **Secret key** (starts with `tr_`)

### 2.2 Set environment variables
In the Trigger.dev dashboard → **Environment Variables**, add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `RESEND_API_KEY` | your Resend key (get in step 3) |
| `FROM_EMAIL` | noreply@yourdomain.com |
| `APP_URL` | https://yourdomain.com |

### 2.3 Deploy jobs
```bash
cd trigger
TRIGGER_SECRET_KEY=tr_xxxx npm run deploy
```

After deploy, go to **Jobs** in the Trigger.dev dashboard — you should see:
- `reminder.send`
- `recurring-tasks.daily`
- `digest.daily`
- `export.generate`

### 2.4 Go back and set Trigger secret in Supabase
```bash
supabase secrets set TRIGGER_SECRET_KEY=tr_xxxx
```

---

## 3. Resend — transactional email

**Sign up:** [resend.com](https://resend.com)

### 3.1 Add and verify your domain
- Go to **Domains → Add domain**
- Enter your domain (e.g. `yourdomain.com`)
- Add the DNS records shown (TXT + MX) — takes 5–30 minutes to propagate
- Click **Verify**

> No domain yet? Use Resend's test mode with `onboarding@resend.dev` as the sender — it works for testing but only delivers to your own verified email address.

### 3.2 Create an API key
- Go to **API Keys → Create API key**
- Name it `justdoit-prod`, full access
- Copy the key (shown only once)

### 3.3 Set the key everywhere
```bash
supabase secrets set RESEND_API_KEY=re_xxxx FROM_EMAIL=noreply@yourdomain.com
```

And in Trigger.dev dashboard → Environment Variables → `RESEND_API_KEY`.

---

## 4. Vercel — frontend hosting

**Sign up:** [vercel.com](https://vercel.com)

Once you have the Next.js frontend repo:

### 4.1 Import project
- Click **Add New → Project**
- Connect your GitHub account and select the frontend repo
- Framework: Next.js (auto-detected)

### 4.2 Set environment variables
In the Vercel project → **Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |

### 4.3 Deploy
Click **Deploy**. Vercel builds and deploys automatically. Every push to `main` triggers a new deploy.

Your frontend URL is `https://your-project.vercel.app` (or a custom domain if you add one).

**Go back to Supabase** → Authentication → URL Configuration and update:
- Site URL: `https://your-project.vercel.app`
- Redirect URLs: `https://your-project.vercel.app/**`

---

## Quick reference: all keys you need

| Key | Used in | Where to find |
|---|---|---|
| `SUPABASE_URL` | Frontend, Trigger.dev | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Frontend only | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets, Trigger.dev | Supabase → Project Settings → API |
| `TRIGGER_SECRET_KEY` | Supabase secrets, deploy cmd | Trigger.dev → Project Settings |
| `RESEND_API_KEY` | Supabase secrets, Trigger.dev | Resend → API Keys |
| `FROM_EMAIL` | Supabase secrets, Trigger.dev | Your sending domain email address |
| `APP_URL` | Supabase secrets, Trigger.dev | Your Vercel URL |

---

## Deployment checklist

- [ ] Supabase project created
- [ ] `supabase db push` ran successfully (all tables visible in Table Editor)
- [ ] All 6 edge functions deployed (`supabase functions deploy`)
- [ ] Supabase Auth Site URL and redirect URLs set
- [ ] GitHub and/or Google OAuth configured (optional)
- [ ] Trigger.dev project created, all 4 jobs deployed
- [ ] Trigger.dev environment variables set
- [ ] Resend domain verified, API key created
- [ ] All secrets set in Supabase (`RESEND_API_KEY`, `TRIGGER_SECRET_KEY`, `FROM_EMAIL`, `APP_URL`)
- [ ] Frontend deployed to Vercel with correct env vars
- [ ] Smoke test: sign up → create note → create task → set reminder

---

## Costs

Everything above is **free** at normal personal-use scale:

| Service | Free limit | You'll use |
|---|---|---|
| Supabase | 500 MB DB, 1 GB storage, 50K users | <5% |
| Trigger.dev | 100K runs/month | <1% |
| Resend | 3,000 emails/month, 100/day | <1% |
| Vercel | Unlimited personal deploys | free |

The only thing that might ever cost money: Supabase Pro ($25/month) if the auto-pause on inactivity bothers you.
