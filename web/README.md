# JustDoIt — Frontend

Next.js 16 / React 19 frontend for the JustDoIt productivity app.

## Prerequisites

- Node.js ≥ 20
- A running Supabase instance (local or cloud) — see the [root README](../README.md) for setup

## Local Dev

```bash
# From the web/ directory
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
```

For a cloud Supabase project, use the project URL and anon key from the Supabase dashboard.

## Commands

```bash
npm run dev       # dev server with Turbopack
npm run build     # production build
npm run start     # serve the production build
npm run lint      # ESLint
```

## Structure

```
src/
├── app/
│   ├── (app)/            # Authenticated routes (dashboard, notes, lists, settings…)
│   │   └── layout.tsx    # Auth guard + sidebar data fetching
│   ├── (auth)/           # Login, register, forgot/reset password
│   └── auth/callback/    # OAuth exchange handler
├── components/
│   ├── layout/           # Sidebar, main layout shell
│   ├── notes/            # NotesList, NoteEditor (Markdown + tag management)
│   ├── tasks/            # TaskList, TaskItem, TaskForm
│   ├── workspaces/       # WorkspaceView
│   ├── settings/         # SettingsView (profile, workspaces, email prefs, export)
│   ├── trash/            # TrashView (restore / hard delete)
│   └── auth/             # AuthCard (login / register forms)
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Browser client (@supabase/ssr createBrowserClient)
│   │   └── server.ts     # Server component client (createServerClient)
│   └── database.types.ts # Generated from Supabase schema (do not edit manually)
└── styles/
    ├── globals.css
    └── tokens.css        # All --jd-* design tokens (colors, spacing, typography)
```

## Auth Pattern

- **Server components / Route Handlers** use `createClient()` from `src/lib/supabase/server.ts`
- **Client components** use `createClient()` from `src/lib/supabase/client.ts`
- The `(app)/layout.tsx` redirects unauthenticated users to `/login`

## Styling

- CSS Modules (`.module.css`) for all component styles
- Design tokens in `src/styles/tokens.css` — all custom properties use the `--jd-` prefix
- Dark theme is the default; `[data-theme="light"]` overrides are in `tokens.css`
- No external CSS framework — use tokens directly

## Regenerating Types

After any backend schema change:

```bash
# From the repo root
npm run types
```

Then copy `shared/database.types.ts` → `web/src/lib/database.types.ts` (or run the copy step if it's scripted).

## Deployment

Deploy to Vercel with zero config:

```bash
vercel
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.

See [`docs/deployment.md`](../docs/deployment.md) for the full production checklist.
