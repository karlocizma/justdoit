# Local Development Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Supabase CLI | ≥ 2.x | `npm install -g supabase` |

---

## First-time Setup

```bash
git clone https://github.com/karlocizma/justdoit
cd justdoit

# Install backend + Trigger.dev deps
npm install
cd trigger && npm install && cd ..

# Install frontend deps
cd web && npm install && cd ..

# Copy env file (pre-filled for local Supabase — no changes needed for basic dev)
cp .env.example .env
```

---

## Starting the Local Stack

### 1 — Backend (Supabase)

```bash
npm run db:start    # starts Supabase (PostgREST, Auth, Realtime, Storage, DB)
npm run db:reset    # applies all migrations and seeds test data
```

After `db:start` you'll see:

```
API URL: http://127.0.0.1:54321
DB URL:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio:  http://127.0.0.1:54323
Inbucket http://127.0.0.1:54324   ← catches all outbound email
anon key: eyJhb...
service_role key: eyJhb...
```

The `.env.example` is already pre-filled with these local values.

### 2 — Frontend (Next.js)

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
```

Then start the dev server:

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Studio

[http://127.0.0.1:54323](http://127.0.0.1:54323) — browse tables, run SQL, inspect logs.

### Inbucket (email catching)

[http://127.0.0.1:54324](http://127.0.0.1:54324) — all emails sent locally (auth confirmations, reminders, etc.) land here.

---

## Test Credentials

| Email | Password | Role |
|---|---|---|
| alice@example.com | password123 | Regular user |
| bob@example.com | password123 | Regular user |

Both are created by `supabase/seed.sql`. Alice owns a workspace that Bob is invited to.

---

## Running Tests

Backend integration tests (run against local Supabase):

```bash
npm test                  # all suites

npm run test:auth         # auth + RLS
npm run test:notes        # notes, tags, full-text search
npm run test:tasks        # lists, tasks, sub-tasks, reorder
npm run test:functions    # Edge Functions: dashboard, search
npm run test:reminders    # reminders + webhook/cancel
npm run test:milestone7   # storage, recurring tasks, export
npm run test:milestone8   # realtime, workspaces, RLS
```

Run a single suite directly:

```bash
npx tsx scripts/test-notes.ts
```

Tests print `✓` / `✗` and exit non-zero on failure. No test framework — plain TypeScript scripts.

Frontend offline data-layer tests (no Supabase needed — pure logic + in-memory IndexedDB):

```bash
cd web && npm run test:offline   # LWW merge, outbox flush ordering/retry, recurrence math
```

Frontend type check:

```bash
cd web && npx tsc --noEmit
```

---

## Editing Edge Functions

Edge Functions live in `supabase/functions/<name>/index.ts` (Deno runtime).

Serve locally:

```bash
supabase functions serve <name> --env-file .env
# or all at once:
supabase functions serve --env-file .env
```

Available at `http://127.0.0.1:54321/functions/v1/<name>`.

### Secrets available to Edge Functions

| Secret | Source |
|---|---|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `RESEND_API_KEY` | From `.env` or `supabase secrets set` |
| `TRIGGER_SECRET_KEY` | From `.env` or `supabase secrets set` |

---

## Adding a Migration

1. Create a new file in `supabase/migrations/` with a numeric or timestamp prefix:
   ```
   supabase/migrations/20260519000012_my_change.sql
   ```
2. Write your SQL.
3. Apply it:
   ```bash
   npm run db:reset    # full reset + all migrations (destroys local data)
   # or
   supabase db push    # incremental push (local stack only)
   ```

Migration filenames are applied in lexicographic order.

### Regenerating TypeScript types after schema changes

```bash
npm run types    # regenerates shared/database.types.ts
```

Commit the updated file so the frontend stays in sync.

---

## Trigger.dev Local Dev (Optional)

```bash
cd trigger
npm run dev    # connects to Trigger.dev cloud, executes jobs locally
```

Requires a `TRIGGER_SECRET_KEY` from [trigger.dev](https://trigger.dev). Without it, the app works normally — background jobs simply won't execute.

---

## Stopping the Stack

```bash
npm run db:stop

# To stop and remove all data:
supabase stop --no-backup
```

---

## Common Issues

### `supabase start` hangs or fails

Make sure Docker Desktop is running:

```bash
supabase stop --no-backup
supabase start
```

### Migration fails on `db:reset`

Check the error output for the specific migration file. Common causes:
- Referencing a table or function defined in a later migration (check ordering)
- Policy name already exists (`drop policy if exists` before `create policy`)
- Extension not enabled (`create extension if not exists`)

### Edge Function returns 403

Ensure you're using the correct key from `supabase status`. The example key in docs may not match your local JWT secret.

### Type errors in test scripts or frontend

Run `npm run types` after any schema change to regenerate `shared/database.types.ts`.

### Hydration mismatch warning in the browser

Browser extensions that inject attributes onto `<html>` (e.g. password managers, AI assistants) can cause React hydration warnings. The root `layout.tsx` already has `suppressHydrationWarning` to silence these — no action needed.
