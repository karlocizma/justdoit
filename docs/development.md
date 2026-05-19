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
git clone https://github.com/your-org/justdoit-backend
cd justdoit-backend
npm install
cd trigger && npm install && cd ..
cp .env.example .env
```

The `.env.example` is pre-filled with local Supabase credentials that work out of the box — you don't need to change anything for basic local dev.

---

## Starting the Local Stack

```bash
npm run db:start    # starts Supabase (PostgREST, Auth, Realtime, Storage, DB)
npm run db:reset    # applies all migrations and seeds test data
```

`db:reset` drops and recreates the database, applies every migration in `supabase/migrations/` in filename order, then runs `supabase/seed.sql`.

After `db:start` you'll see output like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324   ← catches all outbound email
anon key: eyJhb...
service_role key: eyJhb...
```

These values are already set in `.env.example` — no action needed.

### Supabase Studio

Open [http://127.0.0.1:54323](http://127.0.0.1:54323) to browse the database, inspect rows, run SQL, and view logs.

### Inbucket (email catching)

Open [http://127.0.0.1:54324](http://127.0.0.1:54324) to see all emails sent by the local stack (auth confirmations, reminder emails, etc.).

---

## Test Credentials

| Email | Password | Role |
|---|---|---|
| alice@example.com | password123 | Regular user |
| bob@example.com | password123 | Regular user |

Both users are created by `supabase/seed.sql`. Alice has a workspace that both users share (after Bob accepts his invite).

---

## Running Tests

```bash
npm test                  # all 316 tests across all suites

npm run test:auth         # auth + RLS smoke tests (44 tests)
npm run test:notes        # notes, tags, full-text search (72 tests)
npm run test:tasks        # lists, tasks, sub-tasks, reorder (67 tests)
npm run test:functions    # Edge Functions: dashboard, search (18 tests)
npm run test:reminders    # reminders + webhook/cancel (31 tests)
npm run test:milestone7   # storage, recurring tasks, export (35 tests)
npm run test:milestone8   # realtime, workspaces, RLS (49 tests)
```

Tests are plain TypeScript scripts using `@supabase/supabase-js` against the local stack. They don't use a test framework — they print `✓` / `✗` and exit non-zero on failure.

---

## Editing Edge Functions

Edge Functions live in `supabase/functions/<name>/index.ts` and run in a Deno environment.

To test changes without full redeployment:
```bash
supabase functions serve <name> --env-file .env
```

Or serve all at once:
```bash
supabase functions serve --env-file .env
```

Functions served locally are available at `http://127.0.0.1:54321/functions/v1/<name>`.

### Available secrets in Edge Functions

| Secret | Source |
|---|---|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `RESEND_API_KEY` | From `.env` or `supabase secrets set` |
| `TRIGGER_SECRET_KEY` | From `.env` or `supabase secrets set` |

Locally, set these in `.env`:
```env
RESEND_API_KEY=re_test_xxx
TRIGGER_SECRET_KEY=tr_dev_xxx
```

---

## Adding a Migration

1. Create a new file in `supabase/migrations/` with a numeric prefix:
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

Migration filenames are applied in lexicographic order. Use the format `YYYYMMDDHHMMSS_description.sql` or a simple numeric prefix.

### Generating TypeScript types after schema changes

```bash
npm run types    # regenerates shared/database.types.ts
```

Commit the updated `database.types.ts` so the frontend stays in sync.

---

## Trigger.dev Local Dev (Optional)

Background jobs (reminders, recurring tasks, digest emails, export) run on Trigger.dev cloud but can be developed locally:

```bash
cd trigger
npm run dev    # connects to Trigger.dev cloud, executes jobs locally
```

Requires a `TRIGGER_SECRET_KEY` from [trigger.dev](https://trigger.dev). Without it, the app functions normally — background jobs simply won't execute.

---

## Stopping the Stack

```bash
npm run db:stop
```

Or to stop and remove all data:
```bash
supabase stop --no-backup
```

---

## Common Issues

### `supabase start` hangs or fails

Make sure Docker Desktop is running. Try:
```bash
supabase stop --no-backup
supabase start
```

### Migration fails on `db:reset`

Check the error output for the specific migration file. Common issues:
- Referencing a table or function that doesn't exist yet (check migration order)
- Policy name already exists (`drop policy if exists` before `create policy`)
- Extension not enabled (use `create extension if not exists`)

### Edge Function returns 403

If testing with the service role key, ensure you're using the correct key from `supabase status`. The demo key in docs may not match your local JWT secret.

### Type errors in test scripts

Run `npm run types` after any schema change to regenerate `shared/database.types.ts`.
