# Card-flip Data Provenance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an eye button to every chart card that flips the card to reveal where its data came from (SQL / PostHog insight / Hex link) plus last-pulled time and success/failure.

**Architecture:** Extend the data payload end-to-end from `{ rows }` to `{ rows, meta }` using a `SourceMeta` type and an `instrument()` wrapper (`lib/sources/meta.ts`). A reusable `ProvenanceCard` primitive owns a CSS 3D flip and exposes flip state + meta via React context; the shared `CardHeader` reads that context and auto-injects the eye button, so each chart only swaps `<Card>` → `<ProvenanceCard meta={meta}>`. A source-aware `ProvenancePanel` renders the back face.

**Tech Stack:** Next.js (App Router) · React · TypeScript · Tailwind v4 + `globals.css` tokens · Recharts · lucide-react icons.

**Design doc:** `docs/plans/2026-06-20-card-flip-provenance-design.md`

**Testing reality:** This repo has **no unit-test runner** (no jest/vitest). Per-task verification is `npm run typecheck`, `npm run lint`, `npm run build`, plus targeted manual checks in `npm run dev`. Do not add a test framework — it's out of scope. Where pure logic can be smoke-tested, a one-off `node -e` check is noted.

**Branch:** Work continues on `feat/card-flip-provenance` (already created; design doc committed there).

---

## Task 1: SourceMeta type + instrument() helper

**Files:**
- Create: `lib/sources/meta.ts`

**Step 1: Write the file**

```ts
// Shared provenance metadata returned by every data source (mock or real),
// surfaced on the back of each chart card. See docs/plans/2026-06-20-card-flip-provenance-design.md.

export type SourceMeta = {
  source: "snowflake" | "posthog" | "hex" | "sqlite" | "postgres" | "mock" | (string & {});
  ok: boolean;            // did the upstream pull succeed
  fetchedAt: string;      // ISO time the pull ran
  durationMs?: number;    // how long upstream took
  error?: string;         // message when ok=false
  query?: string;         // SQL (Snowflake/Hex/SQLite/Postgres)
  insight?: { id?: string; name?: string; url?: string }; // PostHog
  dashboardUrl?: string;  // Hex/Metabase/Looker link
  rowCount?: number;
  note?: string;
};

// Static descriptor a source supplies; instrument() merges it with timing/status.
type RunResult<T> = { rows: T[] } & Omit<Partial<SourceMeta>, "ok" | "fetchedAt" | "durationMs" | "rowCount">;

/**
 * Wrap a data-source call so every route returns uniform { rows, meta }. Times the
 * call, stamps fetchedAt, and turns a thrown upstream error into ok:false (never
 * breaks the chart — it just renders the error on the back of the card).
 */
export async function instrument<T>(
  source: SourceMeta["source"],
  run: () => Promise<RunResult<T>>,
): Promise<{ rows: T[]; meta: SourceMeta }> {
  const fetchedAt = new Date().toISOString();
  const t0 = performance.now();
  try {
    const { rows, ...descriptor } = await run();
    return {
      rows,
      meta: {
        source,
        ok: true,
        fetchedAt,
        durationMs: Math.round(performance.now() - t0),
        rowCount: rows.length,
        ...descriptor,
      },
    };
  } catch (e) {
    return {
      rows: [],
      meta: {
        source,
        ok: false,
        fetchedAt,
        durationMs: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
```

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no references yet, file compiles).

**Step 3: Smoke-test the helper**

Run:
```bash
node --input-type=module -e "
const { performance } = await import('node:perf_hooks');
globalThis.performance ??= performance;
const m = await import('./lib/sources/meta.ts').catch(() => null);
console.log('ok-path requires ts-runtime; skipping deep run');
"
```
Expected: no throw. (Deep runtime test deferred to the route smoke test in Task 6 — `instrument` is exercised there.)

**Step 4: Commit**

```bash
git add lib/sources/meta.ts
git commit -m "feat: add SourceMeta type and instrument() provenance helper"
```

---

## Task 2: useMetrics returns meta

**Files:**
- Modify: `lib/hooks/useMetrics.ts`

**Step 1: Add meta to the hook**

Change the return type and threaded state to carry `meta`. Final file:

```ts
"use client";

import { useEffect, useState } from "react";

import type { SourceMeta } from "@/lib/sources/meta";

/**
 * Fetches one of the dashboard's `/api/*` JSON endpoints (which return
 * `{ rows, meta }` on success or `{ error }` on failure) with a StrictMode-safe
 * `alive` guard.
 *
 * `url` already encodes the query; a changing URL drives the re-fetch. Pass
 * `refetchKey` (e.g. the global refresh `version`) to force a re-fetch when the URL
 * is unchanged. While the current request differs from the last resolved one, the
 * hook reports nulls so callers render their loading state.
 */
export function useMetrics<Row>(
  url: string,
  refetchKey?: unknown,
): { rows: Row[] | null; error: string | null; meta: SourceMeta | null } {
  const key = `${url}::${String(refetchKey)}`;
  const [result, setResult] = useState<{
    key: string;
    rows: Row[] | null;
    error: string | null;
    meta: SourceMeta | null;
  }>({ key: "", rows: null, error: null, meta: null });

  useEffect(() => {
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setResult({ key, rows: null, error: String(d.error), meta: d.meta ?? null });
        else setResult({ key, rows: (d.rows ?? []) as Row[], error: null, meta: (d.meta ?? null) as SourceMeta | null });
      })
      .catch((e) => {
        if (alive) setResult({ key, rows: null, error: (e as Error).message, meta: null });
      });
    return () => {
      alive = false;
    };
  }, [url, refetchKey, key]);

  if (result.key !== key) return { rows: null, error: null, meta: null };
  return { rows: result.rows, error: result.error, meta: result.meta };
}
```

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (existing callers destructure `{ rows, error }`; adding `meta` is additive).

**Step 3: Commit**

```bash
git add lib/hooks/useMetrics.ts
git commit -m "feat: surface source meta through useMetrics"
```

---

## Task 3: Flip CSS utilities

**Files:**
- Modify: `app/globals.css` (append a utilities block)

**Step 1: Append the flip utilities**

Add at the end of `app/globals.css`:

```css
/* Card-flip provenance: 3D flip with a reduced-motion crossfade fallback. */
@layer utilities {
  .provenance-flip {
    perspective: 1600px;
  }
  .provenance-flip-inner {
    position: relative;
    transform-style: preserve-3d;
    transition: transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .provenance-flip[data-flipped="true"] .provenance-flip-inner {
    transform: rotateY(180deg);
  }
  .provenance-face {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  /* Front face stays in normal flow so it sets the card's height; back overlays it. */
  .provenance-back {
    position: absolute;
    inset: 0;
    transform: rotateY(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .provenance-flip-inner {
      transform: none !important;
      transition: none;
    }
    .provenance-face {
      backface-visibility: visible;
      transition: opacity 200ms ease;
    }
    .provenance-back {
      transform: none;
      opacity: 0;
      pointer-events: none;
    }
    .provenance-flip[data-flipped="true"] .provenance-front {
      opacity: 0;
      pointer-events: none;
    }
    .provenance-flip[data-flipped="true"] .provenance-back {
      opacity: 1;
      pointer-events: auto;
    }
  }
}
```

**Step 2: Verify build picks up the CSS**

Run: `npm run build`
Expected: PASS (CSS compiles; classes available).

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add 3D card-flip CSS utilities with reduced-motion fallback"
```

---

## Task 4: ProvenanceCard primitive + context-injected eye in CardHeader

**Files:**
- Create: `components/ui/ProvenanceCard.tsx`
- Modify: `components/ui/Card.tsx` (CardHeader reads context, renders eye)

**Step 1: Create the context + ProvenanceCard**

`components/ui/ProvenanceCard.tsx`:

```tsx
"use client";

import { createContext, useContext, useId, useRef, useState } from "react";
import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SourceMeta } from "@/lib/sources/meta";
import { ProvenancePanel } from "@/components/ProvenancePanel";

type ProvenanceCtx = {
  meta: SourceMeta | null;
  flipped: boolean;
  flip: () => void;
  backId: string;
};
const Ctx = createContext<ProvenanceCtx | null>(null);

/** Eye toggle rendered by CardHeader when inside a ProvenanceCard. */
export function ProvenanceEye() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.flip}
      aria-label={ctx.flipped ? "Hide data source" : "Show data source"}
      aria-expanded={ctx.flipped}
      aria-controls={ctx.backId}
      title="Where does this data come from?"
      className="flex cursor-pointer items-center justify-center rounded-md border border-border-solid bg-bg-top p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
    >
      <Eye size={14} />
    </button>
  );
}

const CARD_CHROME = "rounded-lg border border-border-solid bg-bg-top";

export function ProvenanceCard({
  meta,
  className,
  children,
}: {
  meta: SourceMeta | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const backId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const flip = () => setFlipped((f) => !f);
  const flipBack = () => setFlipped(false);

  // Esc returns to the front ONLY when focus is inside this card, so it never
  // fights the dashboard's global Esc (insights / selection).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && flipped) {
      e.stopPropagation();
      flipBack();
      wrapRef.current?.querySelector<HTMLElement>("[data-provenance-eye-anchor]")?.focus();
    }
  };

  return (
    <Ctx.Provider value={{ meta, flipped, flip, backId }}>
      <div
        ref={wrapRef}
        className={cn("provenance-flip", className)}
        data-flipped={flipped}
        onKeyDown={onKeyDown}
      >
        <div className="provenance-flip-inner">
          <div className={cn("provenance-face provenance-front overflow-hidden", CARD_CHROME)}>
            {children}
          </div>
          <div
            id={backId}
            className={cn("provenance-face provenance-back overflow-hidden", CARD_CHROME)}
            aria-hidden={!flipped}
          >
            <ProvenancePanel meta={meta} onBack={flipBack} active={flipped} />
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
```

**Step 2: Make CardHeader render the eye**

In `components/ui/Card.tsx`, import the eye and append it after `right`:

```tsx
import { cn } from "@/lib/utils";
import { ProvenanceEye } from "@/components/ui/ProvenanceCard";
```

Change the header's right cluster from `{right}` to:

```tsx
      <div className="flex items-center gap-2">
        {right}
        <span data-provenance-eye-anchor>
          <ProvenanceEye />
        </span>
      </div>
```

(`ProvenanceEye` returns `null` when not inside a `ProvenanceCard`, so plain `Card`s are unaffected. The `data-provenance-eye-anchor` span is the focus target after Esc.)

> ⚠️ Import cycle check: `ProvenanceCard` imports `ProvenancePanel` (Task 5), and `Card` imports `ProvenanceEye` from `ProvenanceCard`. `ProvenanceCard` does **not** import `Card`, so there is no cycle. Keep it that way.

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL until Task 5 creates `ProvenancePanel`. That's expected — proceed to Task 5, then re-run.

**Step 4: Commit (after Task 5 typechecks clean)**

Deferred — committed at end of Task 5.

---

## Task 5: ProvenancePanel (source-aware back face)

**Files:**
- Create: `components/ProvenancePanel.tsx`

**Step 1: Create the panel**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Database, ExternalLink } from "lucide-react";

import type { SourceMeta } from "@/lib/sources/meta";

const SOURCE_LABEL: Record<string, string> = {
  snowflake: "Snowflake",
  posthog: "PostHog",
  hex: "Hex",
  sqlite: "SQLite",
  postgres: "Postgres",
  mock: "Demo data",
};

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1 rounded-md border border-border-solid bg-bg-top px-2 py-1 type-caption text-text-tertiary transition-colors hover:text-text-primary"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ProvenancePanel({
  meta,
  onBack,
  active,
}: {
  meta: SourceMeta | null;
  onBack: () => void;
  active: boolean;
}) {
  const backRef = useRef<HTMLButtonElement>(null);

  // Move focus onto the back panel when it becomes visible (keyboard users land here).
  useEffect(() => {
    if (active) backRef.current?.focus();
  }, [active]);

  const label = meta ? (SOURCE_LABEL[meta.source] ?? meta.source) : "—";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-faint px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            ref={backRef}
            type="button"
            onClick={onBack}
            aria-label="Back to chart"
            className="flex items-center justify-center rounded-md border border-border-solid bg-bg-top p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
          >
            <ArrowLeft size={14} />
          </button>
          <Database size={14} className="text-text-tertiary" />
          <h2 className="type-header text-text-primary">{label}</h2>
        </div>
        {meta ? (
          <span
            className="flex items-center gap-1.5 type-caption text-text-tertiary"
            title={meta.ok ? "Last pull succeeded" : "Last pull failed"}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${meta.ok ? "bg-emerald-500" : "bg-red-500"}`}
            />
            {relTime(meta.fetchedAt)}
            {typeof meta.durationMs === "number" ? ` · ${meta.durationMs}ms` : ""}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {!meta ? (
          <p className="type-body text-text-tertiary">No source metadata available.</p>
        ) : !meta.ok ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
            <p className="type-caption font-mono uppercase tracking-wide text-red-500">Last pull failed</p>
            <p className="mt-1 type-body text-text-primary">{meta.error ?? "Unknown error."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {meta.insight ? (
              <div>
                <p className="type-caption text-text-tertiary">Insight</p>
                <p className="type-body text-text-primary">{meta.insight.name ?? meta.insight.id}</p>
                {meta.insight.url ? (
                  <a
                    href={meta.insight.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 type-caption text-primary hover:underline"
                  >
                    Open in PostHog <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            ) : null}

            {meta.dashboardUrl ? (
              <a
                href={meta.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 type-body text-primary hover:underline"
              >
                Open dashboard <ExternalLink size={12} />
              </a>
            ) : null}

            {meta.query ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="type-caption text-text-tertiary">Query</p>
                  <CopyButton text={meta.query} />
                </div>
                <pre className="overflow-auto rounded-md border border-border-faint bg-bg-subtle p-3 type-caption leading-relaxed text-text-secondary">
                  <code>{meta.query}</code>
                </pre>
              </div>
            ) : null}

            {meta.note ? <p className="type-caption text-text-tertiary">{meta.note}</p> : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-text-tertiary">
              {typeof meta.rowCount === "number" ? <span>{meta.rowCount} rows</span> : null}
              <span>source: {meta.source}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

> Note: if `text-text-secondary` is not a defined token, fall back to `text-text-primary`. Confirm available `--color-text-*` tokens in `app/globals.css` before relying on `text-text-secondary`.

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (Task 4 + Task 5 now resolve each other).

**Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

**Step 4: Commit Tasks 4 + 5 together**

```bash
git add components/ui/ProvenanceCard.tsx components/ui/Card.tsx components/ProvenancePanel.tsx
git commit -m "feat: add ProvenanceCard flip primitive and source-aware back panel"
```

---

## Task 6: Routes + mock return `{ rows, meta }`

Only the routes the 8 charts consume: `app/api/metrics`, `app/api/web`, `app/api/social`. (`/api/kpis` is out of scope — leave it returning `{ rows }`.)

**Files:**
- Modify: `mock/data.ts` (export example-SQL constants per section)
- Modify: `app/api/metrics/route.ts`, `app/api/web/route.ts`, `app/api/social/route.ts`

**Step 1: Add example SQL constants to `mock/data.ts`**

Near the top of `mock/data.ts`, export demo SQL strings the onboard agent will later replace with real queries (one per section the charts use). Example:

```ts
// DEMO provenance — example SQL shown on the back of each card until a real source
// is wired (onboard replaces these in app/api/*/route.ts). Purely illustrative.
export const EXAMPLE_SQL = {
  signups: `SELECT date_trunc('month', created_at) AS PERIOD,
       COALESCE(icp_score, 'Unscored')      AS ICP_SCORE,
       count(*)                             AS SIGNUPS
FROM users
WHERE created_at >= :start
GROUP BY 1, 2
ORDER BY 1;`,
  engagement: `SELECT date_trunc('month', created_at) AS PERIOD, ... -- activation rollup`,
  conversion: `SELECT date_trunc('month', s.created_at) AS PERIOD, ... -- paid-within-window`,
  churn: `SELECT date_trunc('month', canceled_at) AS PERIOD, plan_tier AS PLAN_TIER, ... `,
  traffic: `SELECT date_trunc('month', ts) AS period, count(distinct visitor_id) AS visitors, count(*) AS pageviews FROM pageviews GROUP BY 1;`,
  referrers: `SELECT referrer, count(distinct visitor_id) AS visitors FROM sessions GROUP BY 1 ORDER BY 2 DESC;`,
  survey: `SELECT option, count(*) AS n FROM onboarding_survey GROUP BY 1;`,
  buzz: `SELECT date_trunc('week', created_at) AS period, count(*) AS count FROM mentions GROUP BY 1;`,
} as const;
```

(Flesh out each string to a believable rollup; they're demo-only, exact SQL not critical.)

**Step 2: Wrap each route body in `instrument()`**

Pattern for `app/api/metrics/route.ts` (apply the same shape to `web` and `social`, choosing the right `EXAMPLE_SQL` key per `section`/`metric`):

```ts
import { instrument } from "@/lib/sources/meta";
import { EXAMPLE_SQL /*, existing imports */ } from "@/mock/data";

// inside GET, replacing the existing NextResponse.json({ rows: ... }):
const section = /* the parsed section */;
const { rows, meta } = await instrument("mock", async () => ({
  rows: metricsRows({ section, start, grain, icp }),     // existing mock call
  query: EXAMPLE_SQL[section as keyof typeof EXAMPLE_SQL],
  note: "Demo data — wire a real source in this route (see onboard).",
}));

return NextResponse.json({ rows, meta }, { headers: { "Cache-Control": "no-store" } });
```

Keep all existing query-param parsing and the exact row shapes. The only change is wrapping the data call and adding `meta` to the JSON.

**Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

**Step 4: Smoke-test a route returns meta**

Run (in one terminal `npm run dev`, then):
```bash
curl -s 'http://localhost:3000/api/metrics?section=signups&start=2025-01-01&grain=month' | head -c 400
```
Expected: JSON containing `"rows":[...]` **and** `"meta":{"source":"mock","ok":true,"fetchedAt":...,"query":"SELECT ..."}`.

**Step 5: Commit**

```bash
git add mock/data.ts app/api/metrics/route.ts app/api/web/route.ts app/api/social/route.ts
git commit -m "feat: return source meta from chart API routes"
```

---

## Task 7: Wire all 8 chart cards to ProvenanceCard

**Files (each Modify):**
- `components/BuzzChart.tsx`, `components/WebTrafficChart.tsx`, `components/ReferrersChart.tsx`, `components/OnboardingSurveyChart.tsx`, `components/SignupsChart.tsx`, `components/ActivationChart.tsx`, `components/ConversionChart.tsx`, `components/ChurnChart.tsx`

**Per chart — identical 3 edits:**

1. Import the primitive:
   ```tsx
   import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
   ```
   (Keep importing `CardHeader` from `@/components/ui/Card`; you may drop the now-unused `Card` import.)

2. Capture `meta` from the hook:
   ```tsx
   const { rows: raw, error, meta } = useMetrics<Row>(`/api/...`, version);
   ```

3. Replace the outer wrapper:
   ```tsx
   // before
   <Card> ... </Card>
   // after
   <ProvenanceCard meta={meta}> ... </ProvenanceCard>
   ```
   (If a chart passed `className` to `Card`, pass the same to `ProvenanceCard`.)

**Step 1: Apply to all 8, one at a time.** After each, glance that it still renders.

**Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (Fix any "unused `Card` import" lint errors by removing the import.)

**Step 3: Manual verification matrix (`npm run dev`)**

For at least 3 charts (one `/api/metrics`, one `/api/web`, one `/api/social`):
- Eye appears in the header right cluster (next to the chart-type toggle where present).
- Click eye → card flips with animation → back shows "Demo data", green dot, "just now", and the example SQL with a working Copy button.
- Back-arrow returns to the chart; chart state (chart type toggle, any selection) is preserved.
- Tab to the eye and activate with Enter/Space; after flip, focus lands on the back-arrow; Esc returns and does **not** also clear a chart selection or close Insights.
- Toggle OS "reduce motion" → flip becomes a crossfade, no 3D spin.
- Force an error: temporarily `throw new Error("boom")` inside one route's `instrument` callback → back shows the red error block; chart shows its normal error/empty state. Revert the throw.

**Step 4: Commit**

```bash
git add components/*Chart.tsx
git commit -m "feat: flip every chart card to its data provenance"
```

---

## Task 8: Update the onboard prompt

**Files:**
- Modify: `.claude/commands/onboard.md`

**Step 1: Update the output contract**

In the "### Output contracts" section, change the response-shape description from `{ rows: [...] }` to `{ rows: [...], meta }`, and add a short paragraph:

> Every route also returns a `meta: SourceMeta` (`lib/sources/meta.ts`) describing
> the source — it powers the flip-to-provenance back of each card. Wrap your real
> data call in `instrument("<source>", async () => ({ rows, query, insight, dashboardUrl, note }))`;
> it stamps `fetchedAt`/`durationMs`/`ok`/`error` automatically.

**Step 2: Add a step to the Phase 2 per-chart loop**

After step 7 ("Swap the route body"), insert:

> **7b. Populate provenance.** In the route (or source module), wrap the query in
> `instrument()` and pass the real `query` string you wrote (for SQL sources),
> `insight: { name, url }` (PostHog), or `dashboardUrl` (Hex/BI). This is what the
> card shows when flipped — keep it accurate so the back of the card reflects the
> live source and last-pull status.

**Step 3: Update the "adding a new chart" note**

In Phase 1's "Adding a brand-new chart" paragraph, add:

> Wrap the new chart's card in `<ProvenanceCard meta={meta}>` (not plain `<Card>`)
> and read `meta` from `useMetrics`, so the new chart gets flip-to-provenance for
> free like the others.

**Step 4: Commit**

```bash
git add .claude/commands/onboard.md
git commit -m "docs: teach onboard to populate card provenance meta"
```

---

## Task 9: Final verification

**Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS.

**Step 2: Final manual pass**

In `npm run dev`, flip all 8 cards once; confirm each shows source + status + (SQL where applicable), returns cleanly, and the Refresh button still updates `fetchedAt` ("just now") on the back after a refresh.

**Step 3: Confirm out-of-scope untouched**

KPI row and signals timeline have **no** eye button (expected — fast follow).

**Step 4: Push the branch (only if the user asks)**

```bash
git push -u origin feat/card-flip-provenance
```

---

## Out of scope (fast follow — not this plan)

- KPI row provenance (tiles aren't `Card`-based; needs a compact custom flip).
- Signals timeline provenance (merges changelog + social; multi-source back panel).
