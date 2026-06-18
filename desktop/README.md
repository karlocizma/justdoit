# JustDoIt Desktop (Tauri v2)

A native desktop shell around the JustDoIt web app. Tauri wraps the **hosted**
Next.js frontend in a lightweight system webview (≈a few MB), giving a real
desktop window without re-implementing the UI.

## Why a remote-URL shell (and not a bundled static site)?

The web app is **server-rendered** — it uses React Server Components, the
`src/proxy.ts` middleware auth guard, and an OAuth callback route handler
(`auth/callback/route.ts`). A static export (`output: 'export'`) would break all
three, so the frontend can't be bundled into the app as static files. Instead,
the window loads the running web app over HTTP(S). Offline support still works:
it comes from the web app's own service worker / IndexedDB layer (PWA), not from
Tauri.

## Which URL it loads

Resolved in `src-tauri/src/main.rs::app_url()`:

1. `JUSTDOIT_APP_URL` in the environment at launch, else
2. `JUSTDOIT_APP_URL` baked in at compile time (set by the release CI), else
3. `http://localhost:3000` — the local `web/` dev server.

## Develop

Prerequisites: [Rust](https://rustup.rs) and the
[Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/) for
your OS (on Debian/Ubuntu: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`,
`librsvg2-dev`, `patchelf`, plus `build-essential`).

```bash
# 1. Run the web app (in another terminal)
cd ../web && npm run dev          # http://localhost:3000

# 2. First-time only: generate the platform icon set from icon.png
cd ../desktop && npm install && npm run icon

# 3. Launch the desktop app (loads localhost:3000 by default)
npm run dev

# Point it somewhere else:
JUSTDOIT_APP_URL=https://app.example.com npm run dev
```

## Build installers

Cross-platform installers (`.dmg`, `.msi`/`.exe`, `.deb`/`.AppImage`) are built
in CI — see [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml).
macOS and Windows installers can only be produced on their own runners, so local
`npm run build` only yields a binary for your current OS.

**Release flow:**

1. Set the repo variable `JUSTDOIT_APP_URL` (Settings → Secrets and variables →
   Actions → Variables) to your production URL — this is baked into the binary.
2. Push a tag: `git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`.
3. The workflow builds all platforms and attaches the installers to a **draft**
   GitHub Release; review and publish it.

You can also run the workflow manually (Actions → Desktop Release → Run) and pass
a one-off `app_url` input.

## Code signing (later)

The builds are currently unsigned, so users see an OS "unidentified developer"
warning. To sign, add the platform secrets (Apple Developer ID / notarization,
Windows Authenticode) to the workflow per the
[Tauri signing guide](https://v2.tauri.app/distribute/sign/). Left out for now to
keep the pipeline running without paid certificates.
