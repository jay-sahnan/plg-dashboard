# Setup — make this dashboard yours

This repo is a **PLG (product-led growth) dashboard template**. Out of the box it
runs fully locally with **fabricated data** so you can see the whole thing working
in one command. The goal of setup is to turn it into *your* dashboard: only the
charts you care about, wired to *your* data, with the signals *you* watch on the
right-hand panel.

## The fast path: let the agent do it

This repo ships with an onboarding agent. Open the project in
[Claude Code](https://docs.claude.com/en/docs/claude-code) and run:

```
/onboard
```

The agent interviews you and edits your copy of the repo for you. It will:

1. **Research your product** — it asks for your domain and reads your public
   site/docs to come in with smart defaults.
2. **Pick what to track** — keep only the charts you want; drop the rest (e.g. no
   social buzz graph). Optionally keep or remove the ICP-score breakdown.
3. **Wire each chart to your data** — wherever it lives (your app DB / Supabase /
   Postgres, a warehouse like Snowflake/BigQuery, or product analytics like
   PostHog). For a raw DB it inspects your schema, agrees with you on what
   "activation/conversion/churn" *mean* for your product, and writes the SQL.
4. **Set up the "what shipped & signals" panel** — Slack, Linear, GitHub releases
   (incl. step-by-step Slack bot creation), plus optional Claude-powered insights.
5. **Hosting** — get everything working **locally first**, then (optionally)
   deploy to Vercel.

It works one chart at a time and verifies each before moving on, so you can stop
at any point and still have a working dashboard.

## Run it locally

```bash
npm install          # run this FIRST
npm run dev          # http://localhost:3000  (live editing)
# or a production build:
npm run build && PORT=3008 npm start
```

Always `npm install` before `npm run dev`/`build`. (If a build fails with a cryptic
Turbopack *"couldn't infer your workspace root / Next.js package not found"* error,
it almost always just means dependencies aren't installed yet.)

With no `.env.local`, every chart shows the demo data. As you wire real sources,
copy `.env.example` → `.env.local` and fill in the keys (the agent does this for
you). Local runs persist your goals/targets to `goals.json` on disk.

### Where does the data live?

The dashboard **doesn't store your metrics** — it *reads* them from wherever your
data already lives (your app DB / Supabase / Postgres / a warehouse / analytics) on
each request. So "configuring data" means pointing each chart's API route at your
source. If you have no warehouse and just want something local, a **SQLite** file is
the simplest zero-credential source (read via Node's built-in `node:sqlite`; see
`lib/sources/example.ts`) — but it's just one option, not a requirement. The only
thing the app itself writes locally is `goals.json` (your targets).

## Doing it by hand (no Claude Code)

The same steps work manually — `.claude/commands/onboard.md` is a readable
playbook. The short version:

- **Charts** are composed in `components/Dashboard.tsx`. Remove a chart by deleting
  its import + JSX there, its `components/<Name>Chart.tsx`, and its API route.
- **Data** flows `chart → useMetrics() → /api/* route → mock/data.ts`. To go real,
  edit only the route body in `app/api/*/route.ts`: keep the `{ rows: [...] }`
  response shape and the exact field names (see the contract table in
  `.claude/commands/onboard.md`), and charts need no changes. Put a per-source
  client in `lib/sources/<source>.ts`.
- **Signals panel** (`components/ChangelogTimeline.tsx`) reads `/api/changelog`
  (currently returns `[]`). Populate it from Slack/Linear/GitHub.
- **Goals** persist via `lib/goalsStore.ts` (a file write). On Vercel, swap that
  for a KV/DB store behind the same `readGoals()/writeGoals()` interface.

## Hosting

- **Local (recommended first):** nothing to change. Validate the numbers on your
  machine before deploying.
- **Vercel:** replace the file-based `goals.json` store with a serverless-safe one
  (Vercel KV / Postgres), move secrets into Vercel env vars, and deploy.
