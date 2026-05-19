# JustDoIt

**Notes & Tasks, done right.**

A full-stack productivity app — Markdown notes with tags, to-do lists with sub-tasks, reminders, recurring tasks, file attachments, shared workspaces, and real-time sync.

This repository is the **backend only**. The frontend (React/Next.js) lives in a separate repo and consumes this API.

---

## Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────┐
│  Frontend (separate repo)                                              │
│  React / Next.js · supabase-js v2 · Supabase Realtime WebSocket       │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼─────────────────────────────────────────────┐
│  Supabase (self-hosted or cloud)                                       │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  PostgREST   │  │  Auth (GoTrue│  │  Realtime    │  │  Storage  │ │
│  │  /rest/v1    │  │  /auth/v1)   │  │  /realtime/v1│  │ /storage/ │ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                                                              │
│  ┌──────▼────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL 17  ·  Row Level Security  ·  pg_trgm full-text       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno)                                           │  │
│  │  dashboard · search · export · reminder-webhook                  │  │
│  │  reminder-cancel · workspace-invite                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                           │ Trigger.dev SDK
┌──────────────────────────▼─────────────────────────────────────────────┐
│  Trigger.dev v3 (background jobs)                                      │
│  reminder.send · recurring-tasks.daily · digest.daily · export.generate│
└────────────────────────────────────────────────────────────────────────┘
                           │ Resend SDK
                     ┌─────▼──────┐
                     │  Resend    │
                     │  (email)   │
                     └────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 17 (via Supabase) |
| Auth | Supabase Auth — email/password, GitHub OAuth, Google OAuth |
| API | Supabase PostgREST (auto-generated CRUD) + custom Edge Functions |
| Real-time | Supabase Realtime (WebSocket) |
| Storage | Supabase Storage (S3-compatible) |
| Background jobs | Trigger.dev v3 |
| Email | Resend |
| Local dev | Supabase CLI, Docker |
| Language | TypeScript (Edge Functions, Trigger jobs) · SQL (migrations) |

---

## Quick Start (Local Dev)

### Prerequisites

- Docker Desktop
- Node.js ≥ 20
- Supabase CLI: `npm install -g supabase`

### 1 — Clone and install

```bash
git clone https://github.com/your-org/justdoit-backend
cd justdoit-backend
npm install
cd trigger && npm install && cd ..
```

### 2 — Copy env file

```bash
cp .env.example .env
# Fill in OAuth credentials if you want social login locally.
# TRIGGER_SECRET_KEY and RESEND_API_KEY are optional for local dev — 
# the app degrades gracefully without them.
```

### 3 — Start Supabase

```bash
npm run db:start         # starts all local containers
npm run db:reset         # applies all migrations + seeds test data
```

After start, note the `Project URL` and `API keys` printed to stdout — these are already pre-filled in `.env.example` for local dev.

### 4 — Seed credentials

| Email | Password |
|---|---|
| alice@example.com | password123 |
| bob@example.com | password123 |

### 5 — Run tests

```bash
npm test                 # full suite (316 tests across 7 files)
npm run test:auth        # auth + RLS smoke tests
npm run test:notes       # notes, tags, full-text search
npm run test:tasks       # lists, tasks, sub-tasks, reorder
npm run test:functions   # Edge Functions: dashboard, search
npm run test:reminders   # reminders + reminder-webhook/cancel
npm run test:milestone7  # storage, recurring tasks, export fn
npm run test:milestone8  # realtime publication, workspaces, RLS
```

### 6 — (Optional) Trigger.dev local dev

```bash
cd trigger
npm run dev              # connects to Trigger.dev cloud, runs jobs locally
```

Requires a `TRIGGER_SECRET_KEY` from [trigger.dev](https://trigger.dev).

---

## Project Structure

```
justdoit/
├── supabase/
│   ├── config.toml              # Supabase local config
│   ├── seed.sql                 # Dev seed data (alice + bob)
│   ├── migrations/              # All schema migrations (in order)
│   │   ├── 00001_init.sql       # Tables + indexes
│   │   ├── 00002_rls.sql        # Row Level Security policies
│   │   ├── 00003_functions.sql  # PL/pgSQL helpers + triggers
│   │   ├── 00004_search.sql     # Full-text search (pg_trgm)
│   │   ├── 00005_note_helpers.sql
│   │   ├── 00006_user_id_defaults.sql
│   │   ├── 00007_reminder_webhook.sql
│   │   ├── 00008_reminders_rls_fix.sql
│   │   ├── 00009_storage.sql    # Storage buckets + RLS
│   │   ├── 00010_recurring_tasks.sql
│   │   └── 00011_workspaces.sql # Shared workspaces + Realtime
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── _shared/cors.ts
│   │   ├── auth-hook/           # Profile creation on signup
│   │   ├── dashboard/           # GET aggregate dashboard data
│   │   ├── search/              # GET global search
│   │   ├── export/              # POST trigger data export job
│   │   ├── reminder-webhook/    # POST DB→Trigger.dev bridge
│   │   ├── reminder-cancel/     # POST cancel pending reminder
│   │   └── workspace-invite/    # POST invite user to workspace
│   └── templates/               # Auth email templates (HTML)
├── trigger/
│   ├── jobs/
│   │   ├── email-auth.ts        # Auth confirmation/reset emails
│   │   ├── reminder.ts          # Timed reminder delivery
│   │   ├── recurring-tasks.ts   # Daily overdue-task advancement (cron)
│   │   ├── email-digest.ts      # Daily task digest email (cron)
│   │   └── export.ts            # ZIP export + signed URL email
│   ├── lib/email-templates.ts   # HTML email template functions
│   └── trigger.config.ts
├── shared/
│   └── database.types.ts        # Generated TypeScript types (run `npm run types`)
├── scripts/
│   └── test-*.ts                # Integration test suites
├── docs/                        # Extended documentation (see below)
├── .env.example
└── package.json
```

---

## Database Schema

See [`docs/database.md`](docs/database.md) for the full schema with column descriptions.

**Tables:** `profiles` · `notes` · `note_tags` · `tags` · `todo_lists` · `tasks` · `reminders` · `workspaces` · `workspace_members`

**Storage buckets:** `note-attachments` (5 MB/file) · `exports` (100 MB/file)

**Realtime publication:** `notes` · `tasks` · `todo_lists` · `workspace_members`

---

## API Reference

See [`docs/api-reference.md`](docs/api-reference.md) for complete documentation.

**Quick summary:**

| Type | Endpoint | Description |
|---|---|---|
| PostgREST | `/rest/v1/*` | Full CRUD on all tables (auth + RLS enforced) |
| RPC | `/rest/v1/rpc/toggle_task_complete` | Complete or un-complete a task (handles recurring) |
| RPC | `/rest/v1/rpc/search_all` | Full-text search across notes + tasks |
| RPC | `/rest/v1/rpc/accept_workspace_invite` | Accept a pending workspace invite |
| Edge Fn | `GET /functions/v1/dashboard` | Aggregated dashboard stats |
| Edge Fn | `GET /functions/v1/search` | Filtered global search with type/limit |
| Edge Fn | `POST /functions/v1/export` | Queue a ZIP export (delivers via email) |
| Edge Fn | `POST /functions/v1/reminder-cancel` | Cancel a pending reminder |
| Edge Fn | `POST /functions/v1/workspace-invite` | Invite a user to a workspace |

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for a full production checklist.

Short version:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Push migrations: `supabase db push`
3. Deploy Edge Functions: `supabase functions deploy`
4. Set Edge Function secrets: `supabase secrets set RESEND_API_KEY=... TRIGGER_SECRET_KEY=...`
5. Deploy Trigger.dev jobs: `cd trigger && npm run deploy`
6. Configure OAuth redirect URLs in the Supabase dashboard

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | e.g. `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Safe to expose to clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server-side only) | Never expose to clients |
| `TRIGGER_SECRET_KEY` | No* | Jobs queue silently without it |
| `RESEND_API_KEY` | No* | Emails skipped without it |
| `FROM_EMAIL` | No | Defaults to `noreply@justdoit.app` |
| `APP_URL` | No | Defaults to `https://justdoit.app` |

*Graceful degradation: the app and API work without these, but email delivery and background jobs won't run.

---

## Frontend Integration

The frontend should use the [Supabase JavaScript client](https://supabase.com/docs/reference/javascript):

```bash
npm install @supabase/supabase-js
```

Initialize once:
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './shared/database.types'  // copy from this repo

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

See [`docs/frontend-integration.md`](docs/frontend-integration.md) for patterns, realtime subscriptions, storage uploads, and workspace invite flows.

See [`design-brief.md`](design-brief.md) for the complete UX specification and visual design direction.
