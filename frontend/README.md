# JustDoIt — Design System

> **Notes & Tasks, done right.**
> A calm, focused productivity workspace for notes, to-dos, reminders, and shared workspaces. Desktop-first, dark by default, responsive.

This folder is the design system: tokens, brand voice, visual foundations, and a high-fidelity UI kit you can lift components out of when building screens, mocks, or marketing pages for JustDoIt.

---

## Sources used to build this system

Everything here was synthesized from these inputs. If you have access, dig further — there is much more product context in the backend repo than is captured here.

- **GitHub — `karlocizma/justdoit`** — backend repo (Supabase + Trigger.dev). The two files that drive this design system are:
  - [`design-brief.md`](https://github.com/karlocizma/justdoit/blob/main/design-brief.md) — the authoritative spec for the app's visual identity, screens, components, and interaction notes.
  - [`plan.html`](https://github.com/karlocizma/justdoit/blob/main/plan.html) — a styled architecture document. Its inline CSS is the closest thing to a "live" treatment of the palette in context, and was used to verify the dark-theme accent treatments.
  - [`README.md`](https://github.com/karlocizma/justdoit/blob/main/README.md) and [`docs/`](https://github.com/karlocizma/justdoit/tree/main/docs) — backend architecture, schema, and API surface (referenced for data shapes shown in the UI kit).

> **Note for the reader:** There is no separate frontend repo, no Figma file, and no exported logo assets. Everything visual in this system was authored against the design-brief spec. **Treat this as a reference implementation that's deliberately faithful to the brief, not a recreation of a shipping product.** Anywhere the brief was ambiguous, defaults were made conservatively (Inter for type, a wordmark logo, geometric placeholder iconography). See **Caveats** at the bottom and please iterate.

---

## Index of this folder

```
.
├── README.md                  ← you are here
├── SKILL.md                   ← agent-skill entry point
├── colors_and_type.css        ← all design tokens (CSS variables) — single source of truth
├── assets/                    ← logo, favicons, brand marks, illustrations
├── fonts/                     ← (Google-Fonts–hosted; see Visual Foundations → Type)
├── preview/                   ← design-system preview cards (one concept per file)
└── ui_kits/
    └── webapp/                ← the JustDoIt web app
        ├── README.md
        ├── index.html         ← interactive click-thru prototype
        └── *.jsx              ← React components: sidebar, note card, task item, etc.
```

---

## Product at a glance

JustDoIt is a single productivity web app — there is no separate marketing site or mobile app in scope. The app contains nine surfaces:

1. **Dashboard / Today** — pinned notes, today's tasks, overdue, recents.
2. **Notes list** — grid/masonry of note cards, filterable by Pinned / Archived / Tag.
3. **Note editor** — Markdown editor with a right-rail for color, tags, attachments, reminder.
4. **To-Do list view** — checkable rows with priority, due date, recurrence, sub-tasks.
5. **Task detail panel** — slide-in from right; full edit surface for a single task.
6. **Search results** — unified, keyboard-navigable, grouped by Notes / Tasks.
7. **Auth pages** — login, register, forgot password, reset password.
8. **Settings** — profile, appearance, notifications, export, account.
9. **Workspaces** — switcher + members + invite + pending-invite banner.

The data model behind this UI is shown in the brief: Supabase tables for `notes`, `tasks`, `todo_lists`, `tags`, `reminders`, `workspaces`, `workspace_members`. The UI kit's mock data follows those shapes so it's easy to wire to the real API later.

---

## Content fundamentals

The product **does not have heavy marketing copy** — there's no landing page in scope. Voice rules here are for in-product text: empty states, button labels, tooltips, toasts, settings.

**Tone.** Calm, plain, a little dry. Confident but not breathless. The app's tagline is "Notes & Tasks, done right." — that's the register: a quiet promise, no exclamation marks. Think "developer's personal workspace," not "team productivity SaaS."

**Person.** Second person ("you"), but sparingly. Most UI text doesn't need a subject at all.
- ✅ "No notes yet — create one to get started."
- ✅ "Repeats every 2 weeks"
- ✅ "Export requested — check your inbox"
- ❌ "We'll let you know when your export is ready!" (too perky, "we" not warranted)

**Casing.** Sentence case everywhere — buttons, headings, menu items, settings labels. Never Title Case. Acronyms stay capitalized (JWT, ⌘K).
- ✅ "New note", "Sign in", "Forgot password?"
- ❌ "New Note", "Sign In", "Forgot Password?"

**Punctuation.** Periods are optional on single-sentence UI strings; if a line ends in `?` or `!` keep it, but prefer no `!`. Em-dashes are fine for asides ("Export requested — check your inbox"). Curly quotes when typing prose, straight quotes inside code.

**Buttons & actions.** Verb-first, terse. "Save", "Sign in", "Add reminder", "Delete workspace". No "Submit" or "OK" — name the actual action.

**Empty states.** A short factual line, then a single primary action. No mascots, no jokes.
- "No tasks for today. Add one below."
- "Trash is empty."

**Toasts & system messages.** State the outcome in 1–8 words.
- "Saved", "Reminder cancelled", "Invite sent to alice@example.com", "Couldn't reach the server — retrying"

**Emoji.** **Not used in UI chrome.** The only place emoji appears in the product is the `icon` field on `todo_lists` (user-supplied). The system treats it as user content, not as a brand element.

**Numbers & time.** Relative time in lists ("2 hours ago", "yesterday", "in 3 days"). Absolute when it matters ("Mon, Jun 2 · 14:00"). 24-hour or 12-hour follows the user's locale.

**Keyboard shortcuts.** Always shown with `<kbd>` styling. Use the platform glyph: `⌘K` on Mac, `Ctrl+K` on others. Order: modifier first, key last, plus signs only on PC notation.

---

## Visual foundations

### Colors
- **Two surface tiers** on top of `--jd-bg` (`#0f1117`): `--jd-surface` for cards/sidebar, `--jd-surface-2` for hovers/popovers/raised. A third (`--jd-surface-3`) for selected/pressed.
- **Borders do the heavy lifting**, not shadows. Hairline (`--jd-border` `#2e3350`) on every card, soft divider (`--jd-border-soft`) inside.
- **Primary accent is a single hue:** soft purple `#6c63ff`. Used for: active nav item, primary buttons, focus ring, "today" due-date badge, the brand mark. Never use it as a large background — keep it as accent, focus, or thin border.
- **Secondary accent** teal `#48d1cc` carries inline `<code>` links and "info" semantic states. It's the visual partner to purple — never used together as a gradient on UI chrome, only on the wordmark.
- **Semantic colors** (`danger #e05c5c`, `success #4caf89`, `warn #f5a623`) are muted, not pure. They live mostly as 14%-opacity backgrounds with full-color text on top.
- **Light theme** mirrors the same hierarchy — same accents, inverted surfaces. Treat it as variant, not a separate brand.

### Type
- **Family:** **Inter** for everything (UI, body, headings). **JetBrains Mono** for code blocks, `<kbd>`, and Markdown code fences. Loaded from Google Fonts — see `colors_and_type.css`. *(The brief lists "Inter, Geist, or similar" — Inter chosen because Geist is not freely hosted on Google Fonts. If the brand picks Geist, swap the @import in `colors_and_type.css` and update this paragraph.)*
- **Scale:** display 40 / h1 28 / h2 22 / h3 18 / body 15 / small 13 / tiny 12. The body size is **15px, not 16px** — slightly tighter than web defaults, which matches the dense-but-breathable feel called for in the brief.
- **Line-height:** 1.55 default, **1.7 inside notes** (reading copy gets extra room).
- **Letter-spacing:** tight on display/h1 (`-0.01em`). No spacing on body.
- **Weights:** 400 / 500 / 600 / 700. Use 600 for UI emphasis (button labels, section heads), 700 for h1/h2.

### Spacing
4-based scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48. **Cards are not pillows** — 16px internal padding is typical; the brief explicitly says "dense but breathable, not cramped, not too much whitespace."

### Radii
- **8px** for buttons, inputs, small chips
- **12–16px** for cards (`--jd-radius-lg` `--jd-radius-xl`)
- **999px (pill)** for tag chips and the realtime sync dot

### Borders
1px hairline at `--jd-border`. Cards always have one. Inputs get a slightly softer border that brightens on focus (with a 3px accent-soft outer ring). Buttons mostly have **no border** — they rely on background contrast.

### Shadows
Used sparingly on dark — the eye perceives them poorly. Hierarchy comes from surface tier + border. The exceptions:
- **Popovers / dropdowns / slide-in panels**: `--jd-shadow-lg`
- **Toasts**: `--jd-shadow-md`
- **Hover on note cards**: very slight `--jd-shadow-sm` + border brightening to `--jd-accent-soft`

### Backgrounds
- **No imagery, no gradients, no patterns on UI chrome.** The app is monochromatic dark, period.
- The **only sanctioned gradient** is on the brand wordmark itself: `linear-gradient(135deg, #6c63ff, #48d1cc)` — purple→teal at 135°. Do not reuse this gradient on buttons, cards, or banners.
- **Auth pages** are a single centered card on `--jd-bg`. No hero image, no illustration.
- **Empty states** are an icon + 1–2 lines of text. No illustrated mascots.

### Hover & press states
- **Subtle bg shift, not color shift.** Buttons go `accent → accent-hover` (lighter); ghost rows go `transparent → surface-2`.
- **Press** = darker, no scale transform. `accent → accent-press`.
- **Note cards on hover:** border becomes purple-soft, a row of small icon actions fades in at top-right, the card itself does **not** lift or move.

### Animation
- **Calm, never bouncy.** Default duration **200ms**, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`. Anything longer than 360ms is wrong unless it's a deliberate panel slide.
- **The one animated moment** is the task-complete checkbox: 200ms check-draw + 280ms subtle row-fade + slide to "Completed" section. Everything else (modals, panels, toasts) just fades + 8px translate.
- **No parallax. No scroll-jacked anything. No fancy hover micro-interactions.**

### Transparency & blur
- Used **only** for the slide-in task-detail panel backdrop (`rgba(15,17,23,0.6)` + `backdrop-filter: blur(4px)`).
- The Tweaks/Settings sidebar do **not** blur.
- Note color "accents" are 14% opacity tints — full-saturation hex is reserved for borders and text only.

### Layout rules
- **Sidebar:** fixed 260px on desktop. Collapses to a 64px icon rail at <1100px viewport, then to a bottom tab-bar at <720px (mobile).
- **Top bar:** sticky, 56px tall, search-centered.
- **Content max-width** in notes/editor: 760px reading column. Lists are full-width.
- **Touch targets:** 36px minimum on desktop, 44px on mobile.

### Realtime indicators
A tiny 8px dot in the top bar — `--jd-success` solid when connected, `--jd-fg-faint` outlined when reconnecting. Never red. **No banner, no toast** when reconnecting — silent recovery is the design.

### Cards (the most-used pattern)
- Background: `--jd-surface`
- Border: 1px `--jd-border`
- Radius: `--jd-radius-lg` (12px) for note/task lists, `--jd-radius-xl` (16px) for the dashboard hero cards
- Padding: 16px (small) or 20px (medium)
- Hover: border lightens to `--jd-accent-soft`; cursor:pointer if clickable

---

## Iconography

The brief does not specify an icon set. **Decision: Lucide** (free, MIT, CDN-available, neutral 2px stroke that pairs well with Inter). It's the closest match to the calm-dev-tool aesthetic and is what most Supabase/Vercel-adjacent dashboards use.

- **Source:** CDN — `https://unpkg.com/lucide@latest/dist/umd/lucide.js` or per-icon SVG from `https://lucide.dev/icons/<name>`
- **Default stroke:** 2px
- **Default size:** 16px in dense UI (sidebar items, inline metadata), 20px on buttons, 24px on dashboard hero cards
- **Color:** inherits from `--jd-fg-muted`; active/selected state inherits `--jd-fg` or `--jd-accent`

**Where icons are used:**
- Sidebar nav (home, notes, lists, settings, workspace switcher)
- Top bar (search glyph, user avatar fallback, sync dot)
- Note cards (pin, archive, more-actions)
- Task rows (priority dot, recurrence ↻, due-date calendar, expand chevron)
- Auth pages (OAuth provider marks — GitHub & Google supplied as official brand SVGs in `assets/`)
- Empty states (one big 32px icon at 40% opacity)

**No emoji** in chrome (see Content fundamentals). The one exception is **user-supplied list icons** — the `todo_lists.icon` field accepts an emoji or a Lucide name string. The UI kit renders both.

**No custom SVG illustrations** in the system right now. If/when the brand commissions empty-state illustrations, drop them into `assets/illustrations/` and reference them from this section.

> ⚠️ **Substitution flagged.** No icon set was specified in the brief — Lucide is a choice, not a recovery. If the brand picks Phosphor, Heroicons, or a custom set, the integration is one CDN swap.

---

## Logo

A **wordmark** (no separate logo mark exists in the source repo). The wordmark uses the purple→teal 135° gradient on the letters "Just" and "Do" with "It" in solid `--jd-fg`. See `assets/logo.svg`. A **favicon-friendly monogram** "J" with the same gradient is at `assets/logomark.svg`.

> ⚠️ **Substitution flagged.** No logo file existed in the source repo. The wordmark was constructed from the brief's hero treatment in `plan.html`. Replace `assets/logo.svg` and `assets/logomark.svg` once a real mark exists.

---

## Caveats — what's substituted, what's missing

Read this before iterating.

1. **No real logo file** — wordmark in `assets/logo.svg` is reconstructed from the brief. Treat as placeholder.
2. **Inter substituted for Geist** — the brief offered "Inter, Geist, or similar." Geist is not on Google Fonts; if Geist is the brand pick, swap the `@import` in `colors_and_type.css`.
3. **No frontend repo to read** — every screen in the UI kit was authored from the design-brief spec, not lifted from production code. Pixel-level details (exact spacing on the sidebar nav, exact note-card hover styling) are reasonable guesses inside the brief's stated rules.
4. **Lucide chosen as the icon set** — the brief didn't specify one. Easy to swap.
5. **No empty-state illustrations** — none existed in source. The system uses a large icon + text pattern. If you want bespoke art, that's a separate commission.
6. **Mobile not modeled in depth** — the brief notes a hamburger / bottom-tab-bar pattern. The UI kit is desktop-only at this stage.
7. **Light theme is defined but not screen-tested.** Tokens exist; running the UI kit in `[data-theme="light"]` will get you 90% there but expect to refine borders/contrast on a few components.

---

## How to iterate

This system is a starting point, not a contract. The clearest leverage points:

- **Replace `assets/logo.svg`** with the real mark — everything else inherits.
- **Adjust the accent** in `colors_and_type.css` (`--jd-accent`) — the whole system shifts together.
- **Swap the font family** by editing the `@import` + `--jd-font-sans`.
- **Add a component to the UI kit** — drop a new `.jsx` into `ui_kits/webapp/` and import it from `index.html`. Match the file pattern of `NoteCard.jsx`.
- **Add an empty state, a tooltip pattern, or a print stylesheet** — these are gaps.
