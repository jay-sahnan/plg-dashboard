---
description: Configure this PLG dashboard template for the person who just cloned it — pick charts, wire real data, set up signals, choose hosting.
---

# Onboard a new PLG Dashboard

You are configuring a freshly-cloned copy of this dashboard **for its owner**. It
currently runs on fabricated data (`mock/data.ts`) served through `/api/*` routes.
Your job: interview the user and edit *their* repo so it shows only the charts they
want, wired to *their* data, with the signals they care about — and help them run
it locally first, then deploy if they choose.

## How to work

- **Interview, don't assume.** Use a question tool at each decision point. Offer
  smart, pre-filled defaults from your research (Phase 0), but let the user correct.
- **One chart/source at a time.** Wire it, verify it returns real numbers and the
  chart renders, *then* move on. Keep the mock function in place as a fallback
  until the real one is proven, so the app is never broken between steps.
- **Look things up live.** Don't rely on memory for any third-party API (DB driver,
  PostHog, Slack, Linear, GitHub, etc.) — use web search / fetch to read the
  current official docs for auth and query shape before writing code.
- **Edit directly.** This is the user's own copy; deleting an unwanted chart or
  route is correct and preferred over building a config framework.
- **Secrets go in `.env.local`** (gitignored) and get documented in `.env.example`.
- For anything touching Claude/the Anthropic API (the Insights panel), consult the
  `claude-api` skill for current model IDs and pricing instead of guessing; default
  to the latest Claude model.

## Repo map — where everything lives

Go straight to these; you shouldn't need to explore to find the seams. (Paths are
stable; line numbers aren't given on purpose because you'll be editing the user's
clone — open a file to confirm before editing, but you know *which* file.)

| Path | What it is / when you touch it |
|---|---|
| `app/page.tsx` | Entry point — renders `<Dashboard/>`. |
| `components/Dashboard.tsx` | Top-level layout: the chart `dynamic()` imports + the JSX grid (left column of charts, right `aside` with the signals panel), the toolbar, and where `InsightsPanel`/`SettingsModal` mount. **Add/remove charts here.** |
| `components/*Chart.tsx` | The 8 charts: `BuzzChart`, `WebTrafficChart`, `ReferrersChart`, `OnboardingSurveyChart`, `SignupsChart`, `ActivationChart`, `ConversionChart`, `ChurnChart`. Each reads its data via `useMetrics`. Open the relevant one to see the exact fields it consumes. |
| `components/KpiRow.tsx` | The KPI tiles row; fetches `/api/kpis`. |
| `components/ChangelogTimeline.tsx` | Right-hand **"what shipped & signals"** panel. Reads `/api/changelog`, `/api/social`, `data/changelog.json`. Defines the event shape. |
| `components/InsightsPanel.tsx` | AI Insights slide-over; POSTs `/api/insights`. |
| `components/SettingsModal.tsx` | Goals/targets editor; saves via `app/settings/actions.ts`. |
| `components/DashboardFilters.tsx` | React context holding all filter state (`start`, `grain`, `icp`, `icpBreakdown`, `version`, `goals`, cross-chart selection). `useFilters()` lives here. |
| `components/ChartControls.tsx` | Shared filter UI + `ICP_TIERS` / `ICP_COLORS` + `PERIODS` + drag-select helpers. |
| `lib/hooks/useMetrics.ts` | The one fetch hook every chart uses. Read-only reference — don't change it. |
| `lib/goalsConfig.ts` | Goal metric definitions (`GOAL_METRICS`, `GOAL_KEYS`, `Goals` type). |
| `lib/goalsStore.ts` | Reads/writes `goals.json`. **Swap this for a DB/KV when deploying to Vercel.** |
| `mock/data.ts` | All fabricated series + the functions each API route calls. Source of the current row shapes; delete branches for removed charts. |
| `app/api/*/route.ts` | The data endpoints: `metrics`, `web`, `social`, `kpis`, `goals`, `insights`, `categorize`, `changelog`, `hex-embed`. **Make a chart real by editing its route body here.** |
| `data/changelog.json` | Curated "shipped" events the timeline merges in. |
| `app/globals.css` | Design tokens, incl. `--color-icp-*`. |
| `lib/sources/example.ts` | **Copy this** to `lib/sources/<source>.ts` as your starting point — a worked source module (local SQLite, with a commented Postgres variant) returning the exact contract shape. |
| `.env.example` / `.env.local` | Documented vars / your secrets (gitignored). |

## Architecture you must respect

Data flows: **chart component → `useFilters()` → `useMetrics(url, version)`
(`lib/hooks/useMetrics.ts`) → `fetch('/api/...')` → a route that imports a function
from `@/mock/data` and returns `{ rows: [...] }`.**

➡️ **To make a chart real, you only change the route body in `app/api/*/route.ts`.**
Keep the `{ rows: [...] }` response shape, the route's query params
(`section`, `start`, `grain`, `icp`), and — critically — **the exact field names**.
Then the chart needs zero changes. Always open the chart component to confirm the
field names it actually reads before writing a query.

### Output contracts (field names matter — case-sensitive)

Every route returns `{ rows: [...], meta }`. The `meta` (`SourceMeta` from
`lib/sources/meta.ts`) powers the flip-to-provenance back of each chart card — the
SQL / PostHog insight / dashboard link plus last-pull time and success/failure.
Wrap your real data call in
`instrument("<source>", async () => ({ rows, query, insight, dashboardUrl, note }))`;
it stamps `fetchedAt` / `durationMs` / `ok` / `error` automatically. The row shapes
below are unchanged.

| Route | Row shape |
|---|---|
| `/api/metrics?section=signups` | `{ PERIOD, ICP_SCORE, SIGNUPS }` |
| `/api/metrics?section=engagement` (activation) | `{ PERIOD, ICP_SCORE, ORGS, W1H_1, W24H_5, … }` |
| `/api/metrics?section=conversion` | `{ PERIOD, ICP_SCORE, SIGNUPS, ACTIVATED, PAID_WITHIN_WINDOW }` |
| `/api/metrics?section=churn` | `{ PERIOD, PLAN_TIER, ICP_SCORE, CHURNED }` |
| `/api/web?metric=traffic` | `{ period, visitors, pageviews }` |
| `/api/web?metric=referrers` | `{ referrer, visitors }` |
| `/api/web?metric=survey` | `{ option, n }` |
| `/api/social?metric=buzz` | `{ period, count }` |
| `/api/social?metric=mentions` | `{ timestamp, source, author, body, url }` |
| `/api/kpis` | `{ current, previous, prevComplete, periods }` |
| `/api/changelog` | `{ events: [...] }` (shape per `components/ChangelogTimeline.tsx`) |

Exact formats (charts depend on these — confirm against `mock/data.ts`):
- **`PERIOD`/`period`** = the first day of the bucket as a `YYYY-MM-DD` string:
  monthly → `YYYY-MM-01`; weekly → that week's Monday. Not a full timestamp.
- **`ICP_SCORE`** = an Ideal-Customer-Profile fit tier, exactly one of
  `"A"` / `"B"` / `"C"` / `"Unscored"`. Map any NULL / unknown fit → `"Unscored"`
  (don't emit empty strings or other labels). See Phase 1 for whether to keep it.

Charts are composed in `components/Dashboard.tsx` (dynamic imports near the top, JSX
in the grid). Goals/targets persist via `lib/goalsStore.ts` (writes `goals.json`).

---

## Phase 0 — Orient & research

1. Read `README.md`, skim `mock/data.ts` and `components/Dashboard.tsx`, and tell
   the user what's present: the charts, the KPI row, the right-hand
   "what shipped & signals" panel + AI Insights, and that everything is currently
   mock. (There is leftover **Hex** scaffolding in `app/api/hex-embed/route.ts` —
   treat it as just one optional source; offer to delete it later if unused.)
2. Confirm it runs: `npm install` **first**, then `npm run dev`. A fresh clone builds
   clean (`npm run typecheck && npm run build` both pass) — don't go hunting for
   pre-existing bugs. If a build fails, suspect a missing `npm install` or your own
   edits first; a cryptic Turbopack *"couldn't infer your workspace root / Next.js
   package not found"* error almost always just means dependencies aren't installed.
3. **Research their product.** Ask for the company **domain**, then use built-in
   web search/fetch (no Browserbase or API key needed) to read their site, docs,
   pricing, and any public changelog/blog/social. Form a picture of: what the
   product does, business model (self-serve vs sales-led, free tier, plan tiers),
   the likely "activation" action, who the ideal customer is, and which signal
   sources exist. **Play this back as assumptions to confirm**, and use it to
   pre-fill suggestions in the phases below. The user can correct anything.

---

## Phase 1 — Pick what to track

List the current charts (Buzz, WebTraffic, Referrers, OnboardingSurvey, Signups,
Activation, Conversion, Churn) and KPI tiles, and ask which to **keep / remove**
(lean on your Phase 0 research for a recommendation).

For each **removed** chart, delete in this order, then run `npm run typecheck`:
- its `dynamic()` import and JSX usage in `components/Dashboard.tsx`,
- the component file `components/<Name>Chart.tsx`,
- its API route under `app/api/…` and the corresponding branch in `mock/data.ts`,
- any now-orphaned KPI tile in `components/KpiRow.tsx` / metric in
  `lib/goalsConfig.ts`.

Adding a brand-new chart not in the template is larger work — offer to scaffold one
by cloning the closest existing chart component, but flag it as such. Wrap the new
chart's card in `<ProvenanceCard meta={meta}>` (not plain `<Card>`) and read `meta`
from `useMetrics`, so it gets flip-to-provenance for free like the others.

### ICP-score breakdown decision

Ask: *"Do you break signups / activation / conversion / churn down by ICP
(ideal-customer-fit) score?"* Explain the benefit — you see whether growth comes
from high-fit vs low-fit accounts, and can segment conversion/churn by fit, so you
know if you're attracting the *right* users, not just more of them. Note they can
add it later by scoring accounts (e.g. firmographic enrichment) and tagging each
signup A/B/C.

- **Keep it:** in Phase 2 map their score column → `ICP_SCORE`. If they want the
  capability but have no scores yet, collapse everything to a single `"Unscored"`
  tier — the filter/breakdown UI stays intact.
- **Drop it:** remove the `ICP_SCORE` field from the routes/rows you wire, and
  remove the `IcpFilter` / breakdown toggle and the `icp` / `icpBreakdown` state
  from `components/ChartControls.tsx`, `components/DashboardFilters.tsx`, and the
  toolbar in `components/Dashboard.tsx`, so there's no filter they can't populate.

---

## Phase 2 — Wire each kept chart to real data

This is the core. Run this loop **per chart**:

1. **Ask where this metric lives.** Options: a raw app/product DB (Supabase /
   Postgres / MySQL / Mongo), a warehouse (Snowflake / BigQuery), product analytics
   (PostHog / Amplitude / Mixpanel), a BI embed (Hex / Metabase / Looker), generic
   REST/CSV, or — if they have no warehouse and just want something **local with zero
   credentials** — a **SQLite** file. **The common case is "I just have my app DB" —
   fully supported: connect and compute with SQL.** Different charts may use
   different sources. If they don't pick Hex, offer to delete the leftover Hex
   scaffolding (`app/api/hex-embed/route.ts` + `HEX_*` in `.env.example`).
2. **Read the source's docs live** to get the right client + auth, and install it
   (`npm i`) — e.g. `pg` or the Supabase client for Postgres, the warehouse SDK, or
   the analytics query API. **For the local SQLite path, use Node's built-in
   `node:sqlite` — no dependency to install.** Its types ship with `@types/node` (the
   template pins `^22`) and it's already declared in `serverExternalPackages` in
   `next.config.mjs`, so it just works (it prints one "experimental" warning on first
   use — expected).
3. **Discover the schema** (raw-DB / warehouse path). Introspect tables and columns
   (`information_schema`, the Supabase API, etc.) and show the user the candidate
   tables (`users`, `organizations`, `events`, `subscriptions`, `sessions`, …).
   Confirm which hold signups, accounts/orgs, activity, and billing — don't guess.
4. **Pin down what each metric MEANS for this product** — these are subjective, so
   ask and write the agreed definitions down (in `lib/sources/queries.md`):
   - *Signup* — which table, which timestamp column?
   - *Activation* — which event/threshold counts (e.g. "ran ≥1 query", "invited a
     teammate", "N sessions in 24h")? Map to the engagement contract (`ORGS`,
     `W24H_5`, …) or simplify it.
   - *Conversion* — which signups became paid (a `subscriptions`/`plan` row) within
     what window (template default: 30 days)?
   - *Churn* — cancellation event / `canceled_at`, grouped by `PLAN_TIER`.
   - *ICP score* (if kept) — which column tags account fit → `ICP_SCORE`.
5. **Co-design the query.** Draft SQL (or the analytics query) that rolls raw rows
   up to the dashboard's grain (monthly/weekly `PERIOD` buckets). Share it with the
   user to confirm the logic matches their definition. Transform the result into the
   **exact row shape and field names** from the contract table. Use a single
   `"Unscored"` tier if ICP is kept but unavailable.
6. **Store credentials** in `.env.local` (e.g. `DATABASE_URL`) and document them in
   `.env.example`.
7. **Swap the route body** — replace the `@/mock/data` import/call in
   `app/api/<route>/route.ts` with the real query, preserving the `{ rows: [...] }`
   shape and query params so the chart is untouched. Put a shared client + one query
   function per metric in `lib/sources/<source>.ts` — **copy `lib/sources/example.ts`
   as your starting point** (it's a worked module: a local-SQLite query returning the
   exact contract shape, plus a commented Postgres variant, plus the route-wiring
   snippet). It mirrors how `lib/goalsStore.ts` isolates IO; `app/api/hex-embed/route.ts`
   is a good example of an env-guarded external fetch.
7b. **Populate provenance.** Wrap the query in `instrument()` (see the contract
   note above) and pass the real `query` string you wrote (SQL sources),
   `insight: { name, url }` (PostHog), or `dashboardUrl` (Hex/BI). This is exactly
   what the card shows when flipped — keep it accurate so the back reflects the live
   source and last-pull status.
8. **Verify** — hit the route, confirm real rows, confirm the chart renders. Only
   then move to the next chart. Keep the mock fn until verified.

Also wire the **KPI row** (`/api/kpis`) and any **goals** the same way once the
underlying metrics are real.

---

## Phase 3 — "What shipped & signals" panel + AI Insights

The right-hand `ChangelogTimeline` merges events from `/api/changelog` (currently
returns `[]`). Open `components/ChangelogTimeline.tsx` to see the exact event shape
(title / date / source / url / category), then ask which sources to wire and merge
each into that shape inside `app/api/changelog/route.ts`:

- **Slack** — guided bot setup:
  1. Go to <https://api.slack.com/apps> → **Create New App** → From scratch.
  2. **OAuth & Permissions** → add bot scopes `channels:history` and
     `channels:read` (also `groups:history` for private channels).
  3. **Install to Workspace**, copy the **Bot User OAuth Token** (`xoxb-…`).
  4. Invite the bot to each channel you want to read.
  5. Put the token in `.env.local` as `SLACK_BOT_TOKEN` (+ `SLACK_CHANNEL_IDS`).
  6. Call `conversations.history` per channel and map messages to events.
- **Linear** — create a personal API key (Linear → Settings → API),
  `LINEAR_API_KEY` in env, GraphQL query for completed/shipped issues → events.
- **GitHub releases** — `GITHUB_TOKEN` + `GITHUB_REPO`, pull releases (or merged
  PRs) via REST/GraphQL → events.
- **AI Insights & categorisation** — the Claude calls are **already wired and
  env-gated**: `/api/insights` (`components/InsightsPanel.tsx`) and `/api/categorize`
  (the signals-timeline "Categorise with AI" button) call Claude via plain HTTPS only
  when `ANTHROPIC_API_KEY` is set, and otherwise fall back to a deterministic
  analysis / local heuristic. **So making them real is just: set `ANTHROPIC_API_KEY`
  in `.env.local`.** Insights is grounded on real computed figures (Opus, narrative);
  categorize uses Haiku (cheap bulk labelling) and persists results by event key in
  `categories.json` (swap that store for a DB/KV on serverless, like goals). To change
  models or prompts, edit the `MODEL` const / `system` string in each route — consult
  the `claude-api` skill for current model IDs; default to the latest Claude model.
- **Browserbase (optional / experimental — clearly flag it).** To auto-discover
  external signals (competitor changelogs, news, brand mentions), use a Browserbase
  session to periodically visit pages, extract what changed, and feed entries into
  `/api/changelog`. Set `BROWSERBASE_API_KEY` and write a small fetch-and-extract
  script/route run on demand or on a schedule. Note the caveats (cost, fragility)
  and offer to defer it. *(Phase 0 product research uses only free built-in web
  tools — Browserbase is needed only for this ongoing-monitoring feature.)*

---

## Phase 4 — Hosting: local first, deploy later

Explain the state plainly: code and data live locally, data is pulled fresh per
request, and `goals.json` is written to disk. **Recommend keeping it local first** —
get every chart and signal working against real data and confirm the numbers are
right before deploying. Deploying is a follow-up, not a prerequisite.

- **Local (recommended start):** nothing to change. Optionally add light response
  caching if a source is slow/rate-limited. Document `.env.local` + run commands.
  Only move on once the user confirms the local dashboard looks right.
- **Vercel (when ready):**
  1. Replace the file IO in `lib/goalsStore.ts` with a serverless-safe store
     (Vercel KV / Postgres / Edge Config) **behind the same `readGoals()` /
     `writeGoals()` interface** so nothing else changes. ⚠️ This is the #1 gotcha:
     `goals.json` is read-only on serverless and writes will fail silently.
  2. Move all secrets into Vercel project env vars.
  3. Add `vercel.json` if needed; deploy and verify.

---

## Phase 5 — Wrap up

- Finalize `.env.example` (only the vars they actually use; remove Hex if unused).
- Update `README.md` / `SETUP.md` to reflect the now-real sources.
- Run `npm run typecheck && npm run lint && npm run build`.
- Print a summary: what's wired to real data, what's still mock, and any TODOs
  (e.g. ICP collapsed to Unscored, Browserbase deferred, deploy pending).
