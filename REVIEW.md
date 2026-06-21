# PLG Dashboard — Structure & Code Review

Review of the demo build against Next.js best practices, plus a code-quality pass.
Legend: ✅ = fixed in this pass · 📋 = recommended (not applied).

**Verdict:** the project was already a well-structured, modern Next.js app. This pass
removed the remaining rough edges (no linter, duplicated fetch logic, prop drilling,
eager chart loading, a11y gaps). It now passes `typecheck`, `lint`, and `build` cleanly.

---

## 1. Structure Review (vs Next.js best practices)

| Area | Status | Notes |
|------|--------|-------|
| App Router | ✅ Good | `app/` with `layout.tsx` + `page.tsx`; route handlers under `app/api/*`. Idiomatic Next 16. |
| React / Next versions | ✅ Good | Next 16.2, React 19, TypeScript strict mode. Current. |
| Route handlers | ✅ Good | All `/api/*` routes set `runtime = "nodejs"` and `dynamic = "force-dynamic"` (correct for live/stateful data). |
| Styling | ✅ Good | Tailwind v4 (CSS-first via `@tailwindcss/postcss`), CSS variables, dark mode. |
| Fonts | ✅ Good | `next/font` local fonts with CSS-variable injection in `app/fonts.ts`. |
| Images | ✅ N/A | No raster images; nothing to migrate to `next/image`. |
| Env handling | ✅ Good | No secrets committed; placeholders only. See 📋 env validation below. |
| **ESLint** | ✅ **Fixed** | The project had **no linter** — a real gap. Added flat-config ESLint (`eslint.config.mjs` using `eslint-config-next` core-web-vitals + typescript) and a `lint` script. Note: Next 16 removed `next lint`, so the script runs `eslint .` directly. |
| RSC usage | 📋 Recommended | Every component is `"use client"`; all data loads in the browser. Fine for a demo, but see below. |

---

## 2. Code Review

### ✅ Fixed in this pass

- **Deduplicated data fetching.** The identical `useEffect` + `fetch(..., {cache:'no-store'})`
  + `alive`-guard block was copy-pasted across 8 chart components. Extracted into a single
  generic hook, `lib/hooks/useMetrics.ts` (`useMetrics<Row>(url, refetchKey)`), now consumed
  by every chart. The hook derives its "loading" state during render rather than via a
  synchronous `setState` in an effect, so it satisfies the strict
  `react-hooks/set-state-in-effect` rule and avoids cascading renders.

- **Removed prop drilling via a filters Context.** `Dashboard` was passing the same ~10
  filter/selection props into every chart. Introduced `components/DashboardFilters.tsx`
  (`DashboardFiltersProvider` + `useFilters()`), which owns all filter state and cross-chart
  timeline selection. Charts now read what they need from context; their prop signatures are
  gone. `Dashboard` splits into a thin provider wrapper + `DashboardBody`.

- **Code-split the charts.** `Dashboard` now lazy-loads every Recharts-backed chart (and the
  changelog timeline) via `next/dynamic` (`ssr: false`, with a skeleton placeholder), so the
  heavy Recharts bundle no longer ships in the initial payload.

- **Accessibility.** Added `aria-pressed` to the bar/line, grain, and denominator toggles;
  `aria-haspopup`/`aria-expanded` + Escape-to-close to the ICP-score dropdown; `aria-label`
  to the icon-only "clear range" button; and `role="img"` + descriptive `aria-label` to each
  chart's plot area.

- **Lint cleanups.** Replaced a ternary-as-statement in `ChangelogTimeline` with `if/else`,
  removed an unused variable in `mock/data.ts`, and documented one intentional
  reset-on-range-change effect in `InsightsPanel` with a scoped disable.

### 📋 Recommended (left for a follow-up — behavior-affecting)

- **Move initial data loads to Server Components.** The metric/web/social endpoints could be
  read in a Server Component (or via `fetch` in an RSC) and streamed with `<Suspense>`, with
  only the interactive bits (`'use client'`) hydrated. This would cut client JS and remove the
  initial loading flash, at the cost of restructuring how filters re-fetch.

- **Env validation in `app/api/hex-embed/route.ts`.** It reads `process.env.HEX_API_TOKEN`
  directly. A tiny validation helper (or `@t3-oss/env-nextjs`) would fail fast with a clear
  message when it's unset.

- **Fuller keyboard semantics for the ICP dropdown.** It's now a proper disclosure
  (expanded/escape). Arrow-key navigation + `role="menu"`/`menuitemcheckbox` would make it a
  fully keyboard-operable menu.

- **Tests.** There is no test setup. Worth adding Vitest + React Testing Library for the data
  hook and filter reducer logic before this grows.

---

## 3. Verification

All green as of this review:

```
npm run typecheck   # tsc --noEmit — no errors
npm run lint        # eslint . — no errors or warnings
npm run build       # next build — succeeds, / prerendered, charts code-split
npm run dev         # homepage 200, /api/metrics & /api/web return data
```

## 4. Note on the lockfile

The original `package-lock.json` had `resolved` URLs pointing at a sandbox network proxy
(`socket-firewall…`), which is not resolvable on a normal machine. Those were rewritten to
canonical `https://registry.npmjs.org/` URLs and the lockfile was regenerated to include the
new ESLint dependencies, so `npm install` / `npm ci` now work portably.
