# JustDoIt

**Notes & Tasks, done right.**

A full-stack productivity app — Markdown notes with tags, to-do lists with sub-tasks, kanban board view, task assignment, note version history, reminders, recurring tasks, file attachments, shared workspaces, comments on shared notes, real-time sync, calendar view, browser push notifications, AI-powered note summarization, tag suggestions, task extraction, smart search, an installable PWA, a native desktop app, offline support for notes/tasks/lists, an ICS calendar feed, and more.

This is a **monorepo** containing the complete application:

| Directory | Contents |
|---|---|
| `/` (root) | Supabase backend: migrations, Edge Functions, Trigger.dev jobs, integration tests |
| `web/` | Next.js 16 frontend |
| `trigger/` | Background jobs (Trigger.dev v3) |
| `desktop/` | Tauri v2 desktop app (native shell around the web app) |

---

## Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────┐
│  Frontend  web/                                                        │
│  Next.js 16 · React 19 · CSS Modules · @supabase/ssr                  │
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
│  │  reminder-cancel · workspace-invite · ai                         │  │
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
| Frontend | Next.js 16, React 19, CSS Modules, `@supabase/ssr` |
| Database | PostgreSQL 17 (via Supabase) |
| Auth | Supabase Auth — email/password, GitHub OAuth, Google OAuth |
| API | Supabase PostgREST (auto-generated CRUD) + custom Edge Functions |
| Real-time | Supabase Realtime (WebSocket) |
| Storage | Supabase Storage (S3-compatible) |
| Background jobs | Trigger.dev v3 |
| Email | Resend |
| Local dev | Supabase CLI, Docker |
| Language | TypeScript everywhere · SQL (migrations) |

---

## Quick Start (Local Dev)

### Prerequisites

- Docker Desktop
- Node.js ≥ 20
- Supabase CLI: `npm install -g supabase`

### 1 — Clone and install

```bash
git clone https://github.com/karlocizma/justdoit
cd justdoit
npm install
cd trigger && npm install && cd ..
cd web && npm install && cd ..
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

After `db:start`, the `Project URL` and `API keys` are printed to stdout — they are already pre-filled in `.env.example`.

Copy them into `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

### 4 — Start the frontend

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5 — Seed credentials

| Email | Password |
|---|---|
| alice@example.com | password123 |
| bob@example.com | password123 |

### 6 — Run backend tests

```bash
npm test                 # full suite
npm run test:auth        # auth + RLS
npm run test:notes       # notes, tags, full-text search
npm run test:tasks       # lists, tasks, sub-tasks, reorder
npm run test:functions   # Edge Functions: dashboard, search
npm run test:reminders   # reminders + webhook/cancel
npm run test:milestone7  # storage, recurring tasks, export fn
npm run test:milestone8  # realtime, workspaces, RLS
```

### 7 — (Optional) Trigger.dev local dev

```bash
cd trigger
npm run dev              # connects to Trigger.dev cloud, runs jobs locally
```

Requires a `TRIGGER_SECRET_KEY` from [trigger.dev](https://trigger.dev).

---

## Project Structure

```
justdoit/
├── web/                             # Next.js 16 frontend
│   ├── src/app/                     # App Router pages
│   │   ├── (app)/                   # Authenticated routes
│   │   ├── (auth)/                  # Login / register
│   │   ├── manifest.ts              # PWA web app manifest
│   │   └── offline/                 # Offline fallback page
│   ├── src/components/              # React components
│   ├── src/lib/supabase/            # Browser + server Supabase clients
│   ├── src/lib/offline/             # Offline-first data layer (Dexie cache, outbox, sync)
│   ├── public/sw.js                 # Service worker (push + offline app-shell cache)
│   └── src/styles/tokens.css        # Design tokens (--jd-* CSS variables)
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/                  # Schema migrations (applied in order)
│   └── functions/                   # Edge Functions (Deno)
│       ├── _shared/cors.ts
│       ├── dashboard/
│       ├── search/
│       ├── export/
│       ├── reminder-webhook/
│       ├── reminder-cancel/
│       ├── workspace-invite/
│       └── ai/
├── trigger/
│   └── jobs/
│       ├── email-auth.ts
│       ├── reminder.ts
│       ├── recurring-tasks.ts       # cron
│       ├── email-digest.ts          # cron
│       └── export.ts
├── shared/
│   └── database.types.ts            # Generated types (run `npm run types`)
├── scripts/
│   └── test-*.ts                    # Integration test suites
├── docs/
│   ├── database.md
│   ├── api-reference.md
│   ├── development.md
│   ├── deployment.md
│   └── frontend-integration.md
├── ROADMAP.md                       # Feature backlog and upcoming work
├── CLOUD_SETUP.md                   # Free-tier deployment guide
├── design-brief.md
└── .env.example
```

---

## Database Schema

See [`docs/database.md`](docs/database.md) for the full schema with column descriptions.

**Tables:** `profiles` · `notes` · `note_tags` · `note_versions` · `note_comments` · `tags` · `todo_lists` · `tasks` · `reminders` · `workspaces` · `workspace_members` · `push_subscriptions`

**Storage buckets:** `note-attachments` (5 MB/file) · `exports` (100 MB/file)

**Realtime publication:** `notes` · `tasks` · `todo_lists` · `workspace_members` · `note_comments`

---

## API Reference

See [`docs/api-reference.md`](docs/api-reference.md) for complete documentation.

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
| Edge Fn | `POST /functions/v1/push-subscribe` | Save or remove a browser push subscription |
| Edge Fn | `POST /functions/v1/push-send` | Send a push notification to a user's devices |
| Edge Fn | `POST /functions/v1/ai` | AI actions: `summarize`, `suggest-tags`, `generate-tasks`, `smart-search` (proxies to Anthropic) |
| Edge Fn | `GET /functions/v1/calendar-feed?token=…` | Public ICS feed of due-dated tasks/notes (per-user feed token, no JWT) |

---

## Deployment

See [`CLOUD_SETUP.md`](CLOUD_SETUP.md) for a step-by-step guide deploying on free tiers (Supabase + Trigger.dev + Resend + Vercel).

See [`SELF_HOSTING.md`](SELF_HOSTING.md) to run the whole stack yourself with no managed-cloud dependency (self-hosted Supabase + Trigger.dev + SMTP + Dockerized frontend).

See [`docs/deployment.md`](docs/deployment.md) for the full production checklist.

Short version:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Push migrations: `supabase db push`
3. Deploy Edge Functions: `supabase functions deploy` (9 functions)
4. Generate VAPID keys: `npx web-push generate-vapid-keys`
5. Set Edge Function secrets: `supabase secrets set RESEND_API_KEY=... TRIGGER_SECRET_KEY=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...`
6. Deploy Trigger.dev jobs: `cd trigger && npm run deploy`
7. Deploy the frontend to Vercel: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
8. Configure OAuth redirect URLs in the Supabase dashboard

---

## Environment Variables

See `.env.example` for the full list.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Frontend — e.g. `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Frontend — safe to expose to clients |
| `SUPABASE_URL` | Yes | Backend / Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server-side only) | Never expose to clients |
| `TRIGGER_SECRET_KEY` | No* | Jobs queue silently without it |
| `RESEND_API_KEY` | No* | Emails skipped without it |
| `FROM_EMAIL` | No | Defaults to `noreply@justdoit.app` |
| `APP_URL` | No | Defaults to `https://justdoit.app` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No* | Push notifications require this (frontend) |
| `VAPID_PUBLIC_KEY` | No* | Push notifications require this (Supabase secrets) |
| `VAPID_PRIVATE_KEY` | No* | Push notifications require this (Supabase secrets) |
| `VAPID_SUBJECT` | No* | `mailto:` address for VAPID identification |
| `ANTHROPIC_API_KEY` | No* | Supabase secret — enables AI features for all users; individual users can also set their own key in Settings → AI |

*Graceful degradation: the app works without these, but the relevant feature won't function. Generate VAPID keys with `npx web-push generate-vapid-keys`.

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the full feature backlog and upcoming work.
