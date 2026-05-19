---
name: justdoit-design
description: Use this skill to generate well-branded interfaces and assets for JustDoIt, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

This skill defines the visual identity for **JustDoIt** — a calm, focused notes-and-tasks productivity app. Dark-by-default, monochrome surfaces with a single soft-purple accent (`#6c63ff`) and a secondary teal (`#48d1cc`). Inter for type, JetBrains Mono for code. Borders do hierarchy, not shadows. No emoji in chrome. Sentence case everywhere. See `README.md` for the full content + visual foundations.

**Key files**
- `colors_and_type.css` — all tokens (`--jd-*`). Drop this into any HTML file and basic elements look right.
- `ui_kits/webapp/` — JSX components (sidebar, note card, task row, etc.) and a click-thru `index.html` showing them in context. Lift components from here when building.
- `assets/` — wordmark, monogram, OAuth provider marks, favicon.
- `preview/` — small "spec card" HTML files for each design-system concept. Read these to see tokens in use.

**If creating visual artifacts** (slides, mocks, throwaway prototypes, etc): copy `colors_and_type.css` into your output folder, `<link>` it from your HTML, and lift components from `ui_kits/webapp/*.jsx`. Copy logo/icon assets out of `assets/` — do not redraw them.

**If working on production code**: read `colors_and_type.css` and the foundations sections of `README.md` to learn the rules, then implement against your real component library. The UI-kit JSX is for fidelity reference, not production use.

**If invoked with no other guidance**: ask the user what they want to build (a screen, a slide, a marketing one-pager, an email template), then ask 3–5 clarifying questions about scope, audience, and any variations they want explored. Act as an expert designer who outputs HTML artifacts or production code, depending on the need.

**Things to remember**
- No emoji in chrome. The one exception: user-supplied list icons in `todo_lists.icon`.
- No gradients except on the brand wordmark itself.
- Animation is calm — 200ms, ease-out, never bouncy.
- Sentence case for everything: "New note", not "New Note".
- Verb-first button labels: "Save", "Sign in", "Add reminder".
