# PLG Dashboard — DEMO build

A fully **local, offline** copy of the Browserbase PLG Dashboard with **all data faked**.
No Snowflake, PostHog, Sanity, Octolens or Anthropic — nothing leaves the machine,
no API keys required. Everything is generated deterministically and **trends up**.

## Make it yours

To turn this template into *your* dashboard — keep only the charts you want, wire
them to your real data, and set up your shipping/signals feed — see **[SETUP.md](SETUP.md)**.
The fastest path is to open the repo in [Claude Code](https://docs.claude.com/en/docs/claude-code)
and run **`/onboard`**, which interviews you and edits your copy for you.

## Run it

```bash
npm install
npm run build && PORT=3008 npm start   # http://localhost:3008
# or, for live editing:
npm run dev
```

## What's mock by default

Out of the box every chart reads fabricated data, so the whole dashboard works with
zero setup:

- `mock/data.ts` — all fabricated series (signups, activation, conversion, churn,
  web traffic, referrers, survey, social buzz, mentions, AI insights).
- `app/api/*` — each route serves from `mock/data.ts` until you point it at a real
  source (see **[SETUP.md](SETUP.md)** / `/onboard`).
- `data/changelog.json` — curated sample "shipped" events for the right-hand panel.

Wiring real data is per-chart and reversible: `lib/sources/example.ts` is a
copy-paste starting point, and the mock stays as a fallback until each chart is
proven. See **[SETUP.md](SETUP.md)** for the full walkthrough.
