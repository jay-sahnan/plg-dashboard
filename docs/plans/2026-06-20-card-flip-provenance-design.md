# Card-flip data provenance — design

**Date:** 2026-06-20
**Status:** Approved (design phase)

## Problem

Each chart card shows numbers but gives no answer to "where did this come from
and is it fresh?". We want an eye/info button on every chart card that flips the
whole card with an animation to reveal the data source on the back:

- **Snowflake / SQL warehouse** — the SQL that produced it + when it was last pulled.
- **PostHog** — the insight being used.
- **Hex** — the SQL/chart + last success/failure timestamp.

It must be a **reusable mechanism**, not eight bespoke back-sides: every current
chart gets it, and any chart added later (including by the onboard agent) inherits
it for free. The onboard prompt should populate the provenance when it wires each
source.

## Decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Where provenance data comes from | **Fully dynamic** — instrument at the `lib/sources/*` layer; routes return `{ rows, meta }` with real `fetchedAt`, `durationMs`, `ok`/`error`. |
| Flip trigger | **Click an eye button** in the card header; a back-arrow on the reverse returns. (No hover-flip — bad for touch/AT.) |
| Eye placement | **In the header via React context** — `CardHeader` auto-appends the eye; charts don't edit their header. |
| Scope (this change) | **The 8 chart cards + the reusable primitive.** KPI row and signals timeline are a fast follow. |

## Architecture

Existing data flow is unchanged in shape:

```
chart → useFilters() → useMetrics(url, version) → fetch('/api/...') → route → lib/sources fn
```

We extend the payload end-to-end from `{ rows }` to `{ rows, meta }`.

### 1. Meta contract — `lib/sources/meta.ts`

```ts
export type SourceMeta = {
  source: "snowflake" | "posthog" | "hex" | "sqlite" | "postgres" | "mock" | string;
  ok: boolean;            // did the upstream pull succeed
  fetchedAt: string;      // ISO time the pull ran
  durationMs?: number;    // how long upstream took
  error?: string;         // message when ok=false
  query?: string;         // SQL (Snowflake/Hex/SQLite/Postgres)
  insight?: { id?: string; name?: string; url?: string };  // PostHog
  dashboardUrl?: string;  // Hex/Metabase/Looker link
  rowCount?: number;
  note?: string;
};
```

A small helper wraps every source call so instrumentation is uniform and errors
never break the chart:

```ts
export async function instrument<T>(
  source: string,
  run: () => Promise<{ rows: T[] } & Partial<SourceMeta>>,
): Promise<{ rows: T[]; meta: SourceMeta }> {
  const fetchedAt = new Date().toISOString();
  const t0 = performance.now();
  try {
    const { rows, ...rest } = await run();
    return { rows, meta: { source, ok: true, fetchedAt,
      durationMs: Math.round(performance.now() - t0), rowCount: rows.length, ...rest } };
  } catch (e) {
    return { rows: [], meta: { source, ok: false, fetchedAt,
      durationMs: Math.round(performance.now() - t0), error: (e as Error).message } };
  }
}
```

**Template behaviour:** the mock functions in `mock/data.ts` return `source:"mock"`
plus the *example SQL the onboard agent will later replace*, so the back side is
populated and instructive before any real source is wired.

### 2. Routes — return `{ rows, meta }`

Each `app/api/*/route.ts` returns `meta` alongside `rows`. Keep `Cache-Control:
no-store` and existing query params. Charts that only read `rows` keep working.

### 3. Client hook — `lib/hooks/useMetrics.ts`

Add a third field (backward-compatible):

```ts
{ rows: Row[] | null; error: string | null; meta: SourceMeta | null }
```

The hook reads `d.meta` from the response; callers destructure what they need.

### 4. Reusable flip primitive — `ProvenanceCard` + context

- `components/ui/ProvenanceCard.tsx` replaces a chart's outer `<Card>`. It owns:
  - the 3D flip container (front face = children; back face = `<ProvenancePanel meta={meta} />`),
  - flip state, and
  - a context provider exposing `{ meta, flipped, flip() }`.
- `components/ui/Card.tsx` `CardHeader` reads that context; when present it
  auto-appends the eye button to its existing right cluster (after `right`). **No
  chart edits its header.**
- **Per-chart change is two tokens:** `<Card>` → `<ProvenanceCard meta={meta}>`,
  with `meta` from `useMetrics`. Eight small edits; new charts get it by following
  the same pattern.

**Flip mechanics:** CSS `perspective` on the wrapper, `transform: rotateY(180deg)`
toggled on the inner, `transform-style: preserve-3d`, `backface-visibility:hidden`
per face. New utility classes added to `app/globals.css`; the card's
`overflow-hidden` moves onto the faces. The chart stays mounted during the flip
(transform only) so its local state is preserved — consistent with how Refresh
already refetches without remounting.

**Accessibility / motion:**
- Eye button: `aria-label="Show data source"`, `aria-expanded`.
- Back panel focusable; a back-arrow button returns; Esc returns **only when focus
  is within the flipped card** (stopPropagation) so it doesn't fight the
  dashboard's global Esc (insights/selection).
- `prefers-reduced-motion` → crossfade instead of a 3D spin.

### 5. Source-aware back face — `ProvenancePanel`

`components/ProvenancePanel.tsx` renders from `meta`:

- **Header row:** source icon + name, green/red status dot, "pulled 3m ago · 840ms".
- **Body, by source:**
  - SQL sources (snowflake/hex-sql/sqlite/postgres): `query` in a `<pre>` with a copy button.
  - PostHog: `insight.name` + link (and id).
  - Hex embed: `dashboardUrl` link (+ SQL if present).
  - `ok:false`: prominent error block with `error`.
  - Unknown: generic key/value fallback over present fields.
- Scrolls within the front card's height (`overflow-auto`, matched max-height).

### 6. Onboard prompt — `.claude/commands/onboard.md`

- Output-contracts table: `{ rows }` → `{ rows, meta }`.
- Phase 2 per-chart loop gains a step: "populate `meta` in the source module — set
  `source`, paste the real `query` / `insight` / `dashboardUrl`; `instrument()`
  handles `fetchedAt`/`durationMs`/`ok`/`error`."
- "Adding a new chart" note: use `ProvenanceCard` + return `meta` so new charts get
  provenance automatically.

## Out of scope (fast follow)

- KPI row provenance (tiles aren't `Card`-based — needs a compact custom flip).
- Signals timeline provenance (merges changelog + social — multi-source back panel).

## Testing / verification

- `npm run typecheck && npm run lint && npm run build` clean.
- Manual: each chart's eye flips to a populated back (mock SQL + "pulled just now");
  back-arrow and scoped-Esc return; copy button works; reduced-motion crossfades;
  keyboard focus order sane; a forced source error renders the error block.

## Files touched

- New: `lib/sources/meta.ts`, `components/ui/ProvenanceCard.tsx`,
  `components/ProvenancePanel.tsx`.
- Edit: `lib/hooks/useMetrics.ts`, `components/ui/Card.tsx`, `app/globals.css`,
  all 8 `components/*Chart.tsx`, all chart `app/api/*/route.ts`, `mock/data.ts`,
  `.claude/commands/onboard.md`.
