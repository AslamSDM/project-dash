# PulseBoard — Frontend

The PulseBoard web client: a freelancer / small-agency dashboard for tracking
**client projects**, **revenue**, and **time**. The UI is implemented from a
Claude Design handoff and rendered in the **Recallit visual language** — warm
grape‑violet accents, bright "paper" surfaces, a chunky display typeface, and
hand‑built SVG charts.

- **Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Charts:** hand‑built SVG (no Recharts) — area, donut, weekly bars
- **Data:** talks to the Go API in [`../backend`](../backend) over `/api/*`

---

## Quick start

Requires **Node 20+** (and **Go 1.26+** for the API).

```bash
# from the repo root — starts API (:8080) and web (:5173) together
./dev.sh
```

Then open <http://localhost:5173> and click **Start for free** (registering
auto‑seeds demo projects + revenue, so the dashboard is never empty).

### Run the web app on its own

```bash
cd frontend
npm install        # first time only
npm run dev        # http://localhost:5173, proxies /api → :8080
```

The API must be running for data to load. See the root
[`README.md`](../README.md) for backend setup and the full API reference.

### Other scripts

```bash
npm run build      # tsc -b + vite build → dist/
npm run preview    # serve the production build
npm run lint       # eslint
```

---

## Where things live

```
frontend/src/
  styles/
    recallit.css        # design system: tokens (color/type/space/shadow), base type, atoms
    pulseboard.css      # app layout + components built on those tokens, responsive rules
  components/
    Layout.tsx          # app shell — sidebar, topbar, mobile drawer, route → title
    icons.tsx           # Lucide-style 1.75-stroke icon set
    charts.tsx          # AreaChart, Donut, BarChart (SVG, no deps)
    ui.tsx              # primitives: Button, Card, StatusPill, Avatar, Field, ProgressBar
    ProjectModal.tsx    # create / edit project dialog
  pages/
    Dashboard.tsx       # KPI cards + revenue area + status donut + recent projects
    Projects.tsx        # filter tabs, search, table, empty state, CRUD
    TimeTracking.tsx    # log form, weekly bar chart, entries grouped by day
    Profile.tsx         # profile card + account/password settings
    Landing / Login / Register  # marketing + auth (kept on their original layout)
  lib/
    api.ts              # fetch client + token store
    types.ts            # shared API types
    format.ts           # currency, status styling/colors, project colors, date + initials
  context/AuthContext.tsx  # session state (login/register/logout, restore from token)
```

Global CSS is loaded once in `main.tsx`, in this order: `index.css` (Tailwind)
→ `recallit.css` (tokens + atoms) → `pulseboard.css` (app components). Later
files win, so the design system overrides Tailwind's base where they overlap.

---

## Design choices

### 1. Visual language: Recallit over the original SaaS palette

The brief's own tokens were a generic indigo/slate SaaS look. The design handoff
ships a **binding** design system ("Recallit") in a different language, and the
handoff transcript landed on **PulseBoard's screens rendered in Recallit**. So
the app was re‑themed rather than rebuilt:

| Aspect      | Choice                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Surfaces    | bright paper (`--paper` / `--paper-2`), deep ink‑violet sidebar (`--ink`) |
| Accent      | grape `--amber` `#8338EC` (legacy token name, grape value)            |
| Status      | active → moss green, on‑hold → crayon yellow, completed → muted ink   |
| Shadows     | soft, diffuse, violet‑tinted elevation                                |
| Grain       | subtle multiply noise overlay on sidebar / content / modal            |

Everything is driven by CSS custom properties in `recallit.css`, so re‑theming
(or restoring the indigo/slate palette) is a token edit, not a component rewrite.

### 2. Typography — four typefaces, each with a job

- **Lilita One** (display) — the wordmark, page titles, big KPI numbers. Chunky,
  on‑brand, only used at large sizes.
- **Fraunces italic** (serif) — the warm "Good to see you, …" welcome line.
- **Geist** (sans) — all UI text.
- **JetBrains Mono** (mono) — figures, budgets, timers, progress percentages.

### 3. Hand‑built SVG charts (no Recharts)

The original frontend used Recharts; the design calls for charts that match the
paper aesthetic exactly, so they're rebuilt as plain SVG in `charts.tsx`:

- **AreaChart** — smoothed bézier line + gradient fill, dashed gridlines, hover
  crosshair with an ink tooltip. `preserveAspectRatio="none"` lets it stretch.
- **Donut** — stroked‑arc segments with rounded caps and a center total. Arc
  offsets are precomputed (no mutation during render) so it's render‑safe.
- **BarChart** — track + value bars with a dashed daily‑goal line and hover
  labels.

Dropping Recharts also removed the largest dependency from the bundle.

### 4. App shell

- **Sidebar** — ink‑violet, grain overlay, active item gets a grape rail and
  tint. A "Studio plan" usage widget and sign‑out sit pinned to the bottom.
- **Topbar** — eyebrow + page title (Lilita One). The title is derived from the
  route: the Dashboard greets you by name; other routes show their section name.
- **Responsive** — at ≤920px the sidebar becomes an off‑canvas drawer with a
  scrim and a hamburger toggle; grids collapse to a single column; the table
  reflows to stacked rows.

### 5. Bridging the design to the real API

The prototype used mocked, design‑friendly data; the real backend has a fixed
schema. The mismatches were bridged in the presentation layer so **no API
contract changed**:

- **Project tag color** — the API has no color field, so each project gets a
  **deterministic color** from the crayon palette via `projectColor(id)`. The
  modal's cosmetic swatch picker was dropped (it couldn't persist); the **Spent**
  field was kept because the API needs it.
- **Trends** — only the **revenue** trend pill is shown, computed from the last
  two real monthly data points. No other trend is fabricated.
- **Hours** — the API stores **minutes**; the UI converts to decimal hours for
  the weekly bar chart and entry list. Logging takes hours and posts minutes.
- **Profile** — `handle` is derived from the email local‑part; **Email** and
  **Role** are read‑only because the API only updates name + password. Changing
  the password still requires the correct current password (verified server‑side).
- **Dates** — ISO dates from the API are formatted to short labels ("Jun 18")
  for the table.

### 6. Scope — auth & landing kept as‑is

The design handoff covered the four in‑app screens (Dashboard, Projects, Time,
Profile) plus the shell. The **Landing**, **Login**, and **Register** pages keep
their existing layout, but inherit the new look automatically because their
inputs and buttons use the shared, re‑themed `ui.tsx` primitives.

### 7. Accessibility & interaction notes

- Icon‑only controls (menu, close, edit, delete, notifications) have
  `aria-label`s; the modal closes on **Escape** and on scrim click.
- The notification bell and avatar‑edit button are intentionally decorative —
  there's no backend for notifications or avatar upload yet.
- Destructive deletes (project, time entry) confirm or are immediately undoable
  by re‑creating; project delete uses a `confirm()` guard.

---

## Known follow‑ups

- The notification bell and avatar‑upload affordances are placeholders.
- The "Studio plan / 8 of 10 active projects" sidebar widget is static copy.
- `recharts` is still listed in `package.json` but no longer imported — safe to
  remove on the next dependency pass.
- `AuthContext` triggers a `setState` inside an effect to restore the session
  (a pre‑existing pattern); it works but trips the strict react‑hooks lint rule.
