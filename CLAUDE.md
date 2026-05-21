# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This monorepo has three distinct packages with separate `package.json` files:

| Directory | Purpose | Runtime |
|---|---|---|
| `/` (root) | Supabase backend config, migrations, Edge Functions, integration tests | Node (tsx) |
| `web/` | Next.js 16 frontend | Node (Next.js) |
| `trigger/` | Background jobs (Trigger.dev v3) | Node (ESM) |

The root is the **backend-only** package. `trigger/` is declared as a workspace inside root `package.json`. `web/` is fully independent.

## Commands

### Backend (root)

```bash
npm run db:start          # start local Supabase stack (Docker required)
npm run db:reset          # wipe DB + apply all migrations + seed
npm run db:stop           # stop containers
npm run types             # regenerate shared/database.types.ts from live schema

npm test                  # run all integration test suites
npm run test:auth         # auth + RLS
npm run test:notes        # notes, tags, full-text search
npm run test:tasks        # lists, tasks, sub-tasks, reorder
npm run test:functions    # Edge Functions: dashboard, search
npm run test:reminders    # reminders + webhook/cancel
npm run test:milestone7   # storage, recurring tasks, export
npm run test:milestone8   # realtime, workspaces, RLS
```

Tests are plain TypeScript scripts run via `tsx`. No test framework — they print ✓/✗ and exit non-zero on failure. Run a single suite by calling its script directly: `npx tsx scripts/test-auth.ts`.

To serve an Edge Function locally:
```bash
supabase functions serve <name> --env-file .env
# available at http://127.0.0.1:54321/functions/v1/<name>
```

### Frontend (`web/`)

```bash
cd web
npm install
npm run dev       # Next.js dev server
npm run build     # production build
```

### Trigger.dev jobs (`trigger/`)

```bash
cd trigger
npm run dev       # connect to Trigger.dev cloud, run jobs locally
npm run deploy    # deploy jobs to Trigger.dev cloud
```

## Architecture

### Backend

The API is entirely Supabase — no custom HTTP server:

- **PostgREST** (`/rest/v1/*`) — auto-generated CRUD for all tables, gated by Row Level Security
- **Auth** (`/auth/v1`) — email/password + GitHub/Google OAuth via GoTrue
- **Edge Functions** (Deno, `supabase/functions/`) — custom logic: `dashboard`, `search`, `export`, `reminder-webhook`, `reminder-cancel`, `workspace-invite`, `ai`; each shares `_shared/cors.ts`
- **Realtime** — tables `notes`, `tasks`, `todo_lists`, `workspace_members` published via WebSocket
- **Storage** — `note-attachments` (5 MB/file) and `exports` (100 MB/file) buckets

All migrations live in `supabase/migrations/` and are applied lexicographically. After any schema change, run `npm run types` and commit the updated `shared/database.types.ts`.

**Types lag:** when a migration adds columns or tables not yet reflected in `shared/database.types.ts`, Supabase client calls using those new columns will fail TypeScript. Use `(supabase as any).from(...)` as a short-term workaround and regenerate types at the next opportunity. This currently applies to `note_versions` (table), and `tasks.status` / `tasks.assigned_to` (columns).

**Background jobs** (Trigger.dev v3, `trigger/jobs/`): `reminder.ts`, `recurring-tasks.ts` (cron), `email-digest.ts` (cron), `export.ts`, `email-auth.ts`. Email delivery uses Resend. Both are optional — the app degrades gracefully without `TRIGGER_SECRET_KEY` or `RESEND_API_KEY`.

### Frontend (`web/`)

Next.js 16 with React 19. **This version has breaking changes from prior Next.js versions** — read `node_modules/next/dist/docs/` before writing any Next.js-specific code.

**Route groups:**
- `(app)/` — authenticated routes (dashboard, notes, lists, search, settings, archive, trash, graph, calendar, workspaces); protected by the layout at `src/app/(app)/layout.tsx` which redirects unauthenticated users
- `(auth)/` — login, register, forgot-password, reset-password
- `auth/callback/route.ts` — OAuth exchange handler

**Supabase auth pattern:**
- Server components / Route Handlers use `createClient()` from `src/lib/supabase/server.ts` (`@supabase/ssr` `createServerClient`)
- Client components use `createClient()` from `src/lib/supabase/client.ts` (`@supabase/ssr` `createBrowserClient`)
- `src/proxy.ts` exports the middleware auth guard (imported by `middleware.ts` if present)

**Styling:**
- CSS Modules (`.module.css`) for all components
- Design tokens from `src/styles/tokens.css` — all custom properties use the `--jd-` prefix (colors, spacing, typography, radii, shadows, motion)
- Dark theme is canonical; `[data-theme="light"]` overrides are in `tokens.css`
- No CSS framework — use tokens directly in CSS Modules

## Local Dev Credentials

After `npm run db:reset`:

| Email | Password |
|---|---|
| alice@example.com | password123 |
| bob@example.com | password123 |

Local Supabase URLs (from `supabase start`):
- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Inbucket (email): `http://127.0.0.1:54324`

## Key Environment Variables

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web frontend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side only, never expose to client |
| `TRIGGER_SECRET_KEY` | trigger jobs + Edge Functions |
| `RESEND_API_KEY` | trigger jobs + Edge Functions |
| `ANTHROPIC_API_KEY` | `ai` Edge Function (optional — falls back to per-user key in `profiles.settings`) |

## Reference Docs

- `docs/database.md` — full schema with column descriptions
- `docs/api-reference.md` — complete API docs
- `docs/frontend-integration.md` — supabase-js patterns, realtime, storage, workspace invites
- `docs/deployment.md` — production checklist
- `CLOUD_SETUP.md` — step-by-step free-tier deployment guide
- `design-brief.md` + `frontend/` — UX/visual spec and UI kit
