/*
 * DEMO DATA — entirely fabricated. Nothing here touches Snowflake, PostHog,
 * Sanity, Octolens or Anthropic. Series are generated deterministically to look
 * like a real PLG product: an underlying growth trend, but with month-to-month
 * noise, seasonal waves, launch SPIKES and genuine DIPS/DROPS. Net direction is
 * up, but the line is bumpy — not a clean curve.
 *
 * Before turning this into a public/hostable repo: delete this file, restore the
 * real lib/* integrations, and wire the API routes back to them. (See README.)
 */

// DEMO provenance — example SQL shown on the back of each card until a real source
// is wired (onboard replaces these in app/api/*/route.ts). Purely illustrative; the
// output aliases match the case-sensitive contract field names in onboard.md.
export const EXAMPLE_SQL: Record<string, string> = {
  signups: `SELECT date_trunc('month', u.created_at)         AS PERIOD,
       COALESCE(NULLIF(u.icp_score, ''), 'Unscored') AS ICP_SCORE,
       count(*)                                  AS SIGNUPS
FROM users u
WHERE u.created_at >= :start
GROUP BY 1, 2
ORDER BY 1;`,
  engagement: `SELECT date_trunc('month', o.created_at)         AS PERIOD,
       COALESCE(NULLIF(o.icp_score, ''), 'Unscored') AS ICP_SCORE,
       count(DISTINCT o.id)                       AS ORGS,
       count(DISTINCT o.id) FILTER (WHERE e.activated_24h) AS W24H_5
FROM organizations o
LEFT JOIN engagement e ON e.org_id = o.id
WHERE o.created_at >= :start
GROUP BY 1, 2
ORDER BY 1;`,
  conversion: `SELECT date_trunc('month', s.created_at)         AS PERIOD,
       COALESCE(NULLIF(s.icp_score, ''), 'Unscored') AS ICP_SCORE,
       count(*)                                   AS SIGNUPS,
       count(*) FILTER (WHERE sub.id IS NOT NULL)  AS PAID_WITHIN_WINDOW
FROM signups s
LEFT JOIN subscriptions sub
  ON sub.account_id = s.account_id
 AND sub.started_at <= s.created_at + INTERVAL '30 days'
WHERE s.created_at >= :start
GROUP BY 1, 2
ORDER BY 1;`,
  churn: `SELECT date_trunc('month', sub.canceled_at)      AS PERIOD,
       sub.plan_tier                              AS PLAN_TIER,
       COALESCE(NULLIF(a.icp_score, ''), 'Unscored') AS ICP_SCORE,
       count(*)                                   AS CHURNED
FROM subscriptions sub
JOIN accounts a ON a.id = sub.account_id
WHERE sub.canceled_at IS NOT NULL AND sub.canceled_at >= :start
GROUP BY 1, 2, 3
ORDER BY 1;`,
  // PostHog HogQL (ClickHouse SQL dialect) — runs as a SQL insight over the
  // `events` table. https://posthog.com/docs/hogql
  traffic: `SELECT
    toStartOfMonth(timestamp) AS period,
    uniq(person_id)           AS visitors,   -- unique visitors
    count()                   AS pageviews
FROM events
WHERE event = '$pageview'
  AND timestamp >= {filters.dateRange.from}
GROUP BY period
ORDER BY period`,
  referrers: `SELECT COALESCE(NULLIF(s.referrer, ''), '$direct') AS referrer,
       count(DISTINCT s.visitor_id)              AS visitors
FROM sessions s
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;`,
  survey: `SELECT option, count(*) AS n
FROM onboarding_survey_responses
GROUP BY 1
ORDER BY 2 DESC;`,
  buzz: `SELECT date_trunc('day', m.created_at)          AS period,
       count(*)                                  AS count
FROM mentions m
WHERE m.created_at >= :start
GROUP BY 1
ORDER BY 1;`,
};

const ICP = ["A", "B", "C", "Unscored"] as const;
const ICP_SHARE: Record<string, number> = { A: 0.08, B: 0.17, C: 0.3, Unscored: 0.45 };
const ICP_CONV: Record<string, number> = { A: 2.2, B: 1.4, C: 0.7, Unscored: 0.35 };
const ICP_ACT: Record<string, number> = { A: 1.3, B: 1.12, C: 0.95, Unscored: 0.78 };

// --- deterministic jitter so curves look organic but never change between runs.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Returns a stable multiplier in [1-amp, 1+amp] for a given key. */
function jit(key: string, amp = 0.06): number {
  const r = (hash(key) % 1000) / 1000; // 0..1
  return 1 + (r * 2 - 1) * amp;
}

// --- month axis: 2024-09 .. 2026-06 (inclusive)
function monthList(): string[] {
  const out: string[] = [];
  let y = 2024, m = 9;
  while (y < 2026 || (y === 2026 && m <= 6)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
const MONTHS = monthList();

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const monthNum = (period: string) => Number(period.slice(5, 7));

// Named events that visibly spike or drop the volume series (launches, lulls).
const EVENTS_VOL: Record<string, number> = {
  "2024-12-01": 0.84, // year-end lull
  "2025-04-01": 1.34, // product launch spike
  "2025-07-01": 0.9,  // summer dip
  "2025-08-01": 0.84, // summer dip
  "2025-11-01": 1.16, // marketing push
  "2025-12-01": 0.8,  // holiday drop
  "2026-02-01": 1.12,
  "2026-04-01": 1.55, // big platform launch spike
  "2026-05-01": 0.85, // post-launch retracement
};
// Traffic reacts harder to launches / viral moments than signups do.
const EVENTS_TRAFFIC: Record<string, number> = {
  ...EVENTS_VOL,
  "2025-04-01": 1.45,
  "2026-04-01": 1.7,
  "2026-05-01": 0.82,
};

// Underlying signups level for month i — trend * seasonal * noise * event.
function totalSignups(i: number, period: string): number {
  const trend = 1300 * Math.pow(1.085, i);
  const seasonal = 1 + 0.08 * Math.sin((2 * Math.PI * (monthNum(period) - 2)) / 12);
  const noise = jit(`su${period}`, 0.13);
  const ev = EVENTS_VOL[period] ?? 1;
  return Math.round(trend * seasonal * noise * ev);
}
// W1H_1 activation rate — hand-authored per month so it moves CAUSALLY with the
// changelog: a step up when the guided checklist ships (Nov '25), a BIG spike on
// Onboarding Milestone 1 (Jan '26), a DIP when the platform launch floods the top
// of funnel with low-intent signups (Apr '26), then a spike on the Clerk-phone
// fix + reverse trial (May '26). Small noise keeps it organic.
const ACT_RATE: Record<string, number> = {
  "2024-09-01": 0.32, "2024-10-01": 0.34, "2024-11-01": 0.30, "2024-12-01": 0.27,
  "2025-01-01": 0.38, "2025-02-01": 0.36, "2025-03-01": 0.40, "2025-04-01": 0.31,
  "2025-05-01": 0.42, "2025-06-01": 0.39, "2025-07-01": 0.33, "2025-08-01": 0.37,
  "2025-09-01": 0.43, "2025-10-01": 0.41, "2025-11-01": 0.52, "2025-12-01": 0.44,
  "2026-01-01": 0.64, "2026-02-01": 0.60, "2026-03-01": 0.62, "2026-04-01": 0.36,
  "2026-05-01": 0.66, "2026-06-01": 0.63,
};
// Paid-within-30d rate — moves with billing/pricing: bump on the Upgrade button
// (Oct '25), step on Enhanced Billing (Jan '26), spike on self-serve invoices
// (Feb '26), BIG spike on the pricing drop (Mar '26), dip in the launch flood
// (Apr '26), recovery on per-ms billing (May '26).
const CONV_RATE: Record<string, number> = {
  "2024-09-01": 0.028, "2024-10-01": 0.034, "2024-11-01": 0.030, "2024-12-01": 0.024,
  "2025-01-01": 0.038, "2025-02-01": 0.033, "2025-03-01": 0.036, "2025-04-01": 0.027,
  "2025-05-01": 0.040, "2025-06-01": 0.038, "2025-07-01": 0.032, "2025-08-01": 0.036,
  "2025-09-01": 0.044, "2025-10-01": 0.052, "2025-11-01": 0.046, "2025-12-01": 0.040,
  "2026-01-01": 0.060, "2026-02-01": 0.074, "2026-03-01": 0.102, "2026-04-01": 0.038,
  "2026-05-01": 0.072, "2026-06-01": 0.080,
};
function actBase(_i: number, period: string): number {
  return clamp((ACT_RATE[period] ?? 0.35) * jit(`act${period}`, 0.035), 0.1, 0.9);
}
function convBase(_i: number, period: string): number {
  return clamp((CONV_RATE[period] ?? 0.03) * jit(`cv${period}`, 0.05), 0.005, 0.2);
}

const WINDOWS = [["1H", 1.0], ["24H", 1.22], ["7D", 1.45]] as const;
const SESS = [["1", 1.0], ["5", 0.5], ["10", 0.33], ["100", 0.1]] as const;

export function metrics(section: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  if (section === "signups") {
    MONTHS.forEach((period, i) => {
      const total = totalSignups(i, period);
      for (const icp of ICP) {
        rows.push({ PERIOD: period, ICP_SCORE: icp, SIGNUPS: Math.round(total * ICP_SHARE[icp] * jit(`${period}${icp}`, 0.1)) });
      }
    });
    return rows;
  }

  if (section === "engagement") {
    MONTHS.forEach((period, i) => {
      const total = totalSignups(i, period);
      const rate = actBase(i, period);
      for (const icp of ICP) {
        const orgs = Math.round(total * ICP_SHARE[icp] * 0.92 * jit(`${period}${icp}o`, 0.1));
        const row: Record<string, unknown> = { PERIOD: period, ICP_SCORE: icp, ORGS: orgs };
        for (const [w, wm] of WINDOWS) {
          for (const [s, sm] of SESS) {
            const hit = clamp(Math.round(orgs * rate * wm * sm * ICP_ACT[icp] * jit(`${period}${icp}${w}${s}`, 0.05)), 0, orgs);
            row[`W${w}_${s}`] = hit;
          }
        }
        rows.push(row);
      }
    });
    return rows;
  }

  if (section === "conversion") {
    MONTHS.forEach((period, i) => {
      const total = totalSignups(i, period);
      const rate = actBase(i, period);
      const cb = convBase(i, period);
      for (const icp of ICP) {
        const signups = Math.round(total * ICP_SHARE[icp] * jit(`${period}${icp}`, 0.1));
        const orgs = Math.round(signups * 0.92);
        const activated = clamp(Math.round(orgs * rate * ICP_ACT[icp]), 0, orgs);
        const paid = clamp(Math.round(signups * cb * ICP_CONV[icp] * jit(`${period}${icp}c`, 0.1)), 0, activated);
        rows.push({ PERIOD: period, ICP_SCORE: icp, SIGNUPS: signups, ACTIVATED: activated, PAID_WITHIN_WINDOW: paid });
      }
    });
    return rows;
  }

  if (section === "churn") {
    const PLANS: [string, number][] = [["Hobby ($20)", 0.62], ["Startup ($99)", 0.38]];
    const ICP_CHURN: Record<string, number> = { A: 0.1, B: 0.18, C: 0.32, Unscored: 0.4 };
    // Generally declining (improving retention) but with a couple of bad months
    // — e.g. a billing migration that briefly spikes cancellations.
    const CHURN_EVENTS: Record<string, number> = { "2025-11-01": 1.3, "2026-04-01": 1.5, "2026-05-01": 1.2 };
    MONTHS.forEach((period, i) => {
      const trend = 150 * Math.pow(0.965, i);
      const spike = CHURN_EVENTS[period] ?? 1;
      const total = trend * jit(`ch${period}`, 0.16) * spike;
      for (const [plan, ps] of PLANS) {
        for (const icp of ICP) {
          rows.push({ PERIOD: period, PLAN_TIER: plan, ICP_SCORE: icp, CHURNED: Math.max(0, Math.round(total * ps * ICP_CHURN[icp] * jit(`${period}${plan}${icp}`, 0.12))) });
        }
      }
    });
    return rows;
  }

  return [];
}

export function web(metric: string): Record<string, unknown>[] {
  if (metric === "traffic") {
    return MONTHS.map((period, i) => {
      const trend = 40000 * Math.pow(1.072, i);
      const seasonal = 1 + 0.07 * Math.sin((2 * Math.PI * (monthNum(period) - 2)) / 12);
      const ev = EVENTS_TRAFFIC[period] ?? 1;
      const visitors = Math.round(trend * seasonal * jit(`v${period}`, 0.14) * ev);
      const pageviews = Math.round(visitors * (2.5 + 0.5 * jit(`pv${period}`, 0.6)));
      return { period, visitors, pageviews };
    });
  }
  if (metric === "referrers") {
    return [
      { referrer: "google.com", visitors: 48210 },
      { referrer: "$direct", visitors: 26110 },
      { referrer: "x.com", visitors: 21540 },
      { referrer: "news.ycombinator.com", visitors: 18920 },
      { referrer: "github.com", visitors: 14430 },
      { referrer: "reddit.com", visitors: 9870 },
      { referrer: "bing.com", visitors: 6120 },
      { referrer: "linkedin.com", visitors: 5340 },
      { referrer: "youtube.com", visitors: 4210 },
      { referrer: "duckduckgo.com", visitors: 2980 },
    ];
  }
  if (metric === "survey") {
    return [
      { option: "AI agents", n: 4120 },
      { option: "Web scraping", n: 3580 },
      { option: "Browser automation", n: 3110 },
      { option: "Testing / QA", n: 1980 },
      { option: "Data extraction", n: 1760 },
      { option: "Form filling", n: 1230 },
      { option: "Research", n: 1040 },
      { option: "Monitoring", n: 820 },
      { option: "RPA", n: 610 },
      { option: "Other", n: 540 },
    ];
  }
  return [];
}

// Daily social-mention volume, 2025-09-01 .. 2026-06-15. Rising baseline, heavy
// day-to-day variance, weekend lulls, a launch-week spike + a couple viral days.
export function buzz(): { period: string; count: number }[] {
  const out: { period: string; count: number }[] = [];
  const start = new Date(Date.UTC(2025, 8, 1));
  const end = new Date(Date.UTC(2026, 5, 15));
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  const SPIKES: Record<string, number> = { "2025-11-12": 60, "2026-01-23": 48, "2026-03-04": 52 };
  for (let d = 0; d <= totalDays; d++) {
    const day = new Date(start.getTime() + d * 86400000);
    const period = day.toISOString().slice(0, 10);
    const base = 6 + 49 * (d / totalDays); // 6 -> 55 baseline
    const dow = day.getUTCDay();
    const weekFactor = dow === 0 || dow === 6 ? 0.65 : 1;
    let count = Math.round(base * weekFactor * jit(period, 0.38)); // big daily variance
    if (period >= "2026-04-06" && period <= "2026-04-12") count += Math.round(75 * jit(period + "spk", 0.2)); // launch week
    if (SPIKES[period]) count += SPIKES[period]; // one-off viral days
    out.push({ period, count: Math.max(1, count) });
  }
  return out;
}

// A few positive social mentions for the "What shipped & signals" feed.
export function mentions(): Record<string, unknown>[] {
  return [
    { timestamp: "2026-06-10T14:20:00Z", source: "x", author: "@dev_sarah", body: "Shipped a project on Acme in an afternoon — everything just worked out of the box. Wild DX.", url: "https://x.com" },
    { timestamp: "2026-05-22T09:05:00Z", source: "reddit", author: "u/scraper_pro", body: "Moved our whole workflow to Acme. It just works, zero babysitting. No regrets.", url: "https://reddit.com" },
    { timestamp: "2026-04-08T17:40:00Z", source: "hackernews", author: "tjholowaychuk", body: "The new Acme launch is slick — the dashboard is genuinely useful for debugging.", url: "https://news.ycombinator.com" },
    { timestamp: "2026-03-30T11:15:00Z", source: "linkedin", author: "Priya Nair", body: "Acme cut our infra maintenance to basically zero. Highly recommend for any team.", url: "https://linkedin.com" },
    { timestamp: "2026-02-12T08:30:00Z", source: "bluesky", author: "@buildwithai", body: "Self-serve invoices + usage-based billing on Acme is exactly what I wanted. Easy upgrade.", url: "https://bsky.app" },
  ];
}

type Insight = { title: string; detail: string; kind: "trend" | "cause" | "risk" | "opportunity"; confidence: "high" | "medium" | "low" };

// Data-driven analysis of the selected window: computes real figures from the
// series for the range + ICP tiers, compares to goals, and lets the steer prompt
// reorder/focus the cards. Deterministic, so it reads like a real (if shallow) LLM pass.
export function insights(opts: {
  start: string;
  end: string;
  icp?: string[];
  excludeCurrent?: boolean;
  prompt?: string;
  goals?: Record<string, number>;
}): { summary: string; insights: Insight[]; range: { start: string; end: string } } {
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtYM = (ym: string) => {
    const [y, m] = ym.split("-");
    return MONS[Number(m) - 1] ? `${MONS[Number(m) - 1]} '${(y ?? "").slice(2)}` : ym;
  };
  const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);
  const chg = (first: number, last: number) => (first ? Math.round(((last - first) / first) * 1000) / 10 : 0);

  const start = opts.start.slice(0, 7);
  const end = opts.end.slice(0, 7);
  const icp = opts.icp && opts.icp.length ? opts.icp : [...ICP];
  const goals = opts.goals ?? {};
  const cutoff = currentMonthStart();
  const ok = (period: string, score?: string) =>
    period.slice(0, 7) >= start &&
    period.slice(0, 7) <= end &&
    (!opts.excludeCurrent || period < cutoff) &&
    (score === undefined || icp.includes(score));

  // Signups — monthly totals, trend, peak.
  const sByMonth = new Map<string, number>();
  for (const r of metrics("signups"))
    if (ok(String(r.PERIOD), String(r.ICP_SCORE)))
      sByMonth.set(String(r.PERIOD), (sByMonth.get(String(r.PERIOD)) ?? 0) + Number(r.SIGNUPS));
  const sM = [...sByMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const signupsTotal = sM.reduce((a, [, v]) => a + v, 0);
  const sTrend = chg(sM[0]?.[1] ?? 0, sM[sM.length - 1]?.[1] ?? 0);
  const peak = sM.length ? sM.reduce((mx, e) => (e[1] > mx[1] ? e : mx)) : ["", 0] as [string, number];

  // Activation — weighted rate + first→last pp move.
  const aByMonth = new Map<string, { orgs: number; hit: number }>();
  for (const r of metrics("engagement"))
    if (ok(String(r.PERIOD), String(r.ICP_SCORE))) {
      const e = aByMonth.get(String(r.PERIOD)) ?? { orgs: 0, hit: 0 };
      e.orgs += Number(r.ORGS);
      e.hit += Number(r.W1H_1 ?? 0);
      aByMonth.set(String(r.PERIOD), e);
    }
  const aM = [...aByMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const aTot = aM.reduce((acc, [, v]) => ({ orgs: acc.orgs + v.orgs, hit: acc.hit + v.hit }), { orgs: 0, hit: 0 });
  const actRate = aTot.orgs ? Math.round((1000 * aTot.hit) / aTot.orgs) / 10 : 0;
  const mRate = (v: { orgs: number; hit: number }) => (v.orgs ? (100 * v.hit) / v.orgs : 0);
  const actTrend = aM.length ? Math.round((mRate(aM[aM.length - 1][1]) - mRate(aM[0][1])) * 10) / 10 : 0;

  // Conversion — rate + tier mix.
  let cSig = 0, paid = 0;
  const paidByTier: Record<string, number> = {}, sigByTier: Record<string, number> = {};
  for (const r of metrics("conversion"))
    if (ok(String(r.PERIOD), String(r.ICP_SCORE))) {
      cSig += Number(r.SIGNUPS);
      paid += Number(r.PAID_WITHIN_WINDOW);
      paidByTier[String(r.ICP_SCORE)] = (paidByTier[String(r.ICP_SCORE)] ?? 0) + Number(r.PAID_WITHIN_WINDOW);
      sigByTier[String(r.ICP_SCORE)] = (sigByTier[String(r.ICP_SCORE)] ?? 0) + Number(r.SIGNUPS);
    }
  const convRate = cSig ? Math.round((10000 * paid) / cSig) / 100 : 0;
  const abShare = paid ? Math.round((100 * ((paidByTier.A ?? 0) + (paidByTier.B ?? 0))) / paid) : 0;
  const tRate = (t: string) => (sigByTier[t] ? (100 * (paidByTier[t] ?? 0)) / sigByTier[t] : 0);
  const aMult = tRate("Unscored") ? tRate("A") / tRate("Unscored") : 0;

  // Churn — total + trend.
  const chByMonth = new Map<string, number>();
  for (const r of metrics("churn"))
    if (ok(String(r.PERIOD), String(r.ICP_SCORE)))
      chByMonth.set(String(r.PERIOD), (chByMonth.get(String(r.PERIOD)) ?? 0) + Number(r.CHURNED));
  const chM = [...chByMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const churnTotal = chM.reduce((a, [, v]) => a + v, 0);
  const chTrend = chg(chM[0]?.[1] ?? 0, chM[chM.length - 1]?.[1] ?? 0);

  // Visitors (not ICP-scoped).
  let visitors = 0;
  for (const r of web("traffic")) if (ok(String(r.period))) visitors += Number(r.visitors);

  const tierLabel = icp.length === ICP.length ? "all tiers" : icp.join("/");
  const cards: Array<Insight & { topic: string }> = [];

  cards.push({
    topic: "signups", kind: "trend", confidence: "high",
    title: `Signups ${sTrend >= 0 ? "grew" : "declined"} ${Math.abs(sTrend)}% across the window`,
    detail: `${kfmt(signupsTotal)} signups total (${tierLabel}). Monthly volume moved ${kfmt(sM[0]?.[1] ?? 0)} → ${kfmt(sM[sM.length - 1]?.[1] ?? 0)}, peaking at ${kfmt(peak[1])}${peak[0] ? ` in ${fmtYM(peak[0].slice(0, 7))}` : ""}.`,
  });
  cards.push({
    topic: "activation", kind: "cause", confidence: "medium",
    title: `Activation held at ${actRate}% (${actTrend >= 0 ? "+" : ""}${actTrend}pp)`,
    detail: `${actRate}% of orgs ran a session within 1h of signup, ${actTrend >= 0 ? "up" : "down"} ${Math.abs(actTrend)}pp from the first month to the last.`,
  });
  const convGoal = goals.conversion;
  if (convGoal && convRate < convGoal) {
    cards.push({
      topic: "conversion", kind: "risk", confidence: "high",
      title: `Paid conversion ${convRate}% is below the ${convGoal}% goal`,
      detail: `${kfmt(paid)} of ${kfmt(cSig)} signups paid within 30d (${convRate}%) — ${Math.round((convGoal - convRate) * 10) / 10}pp short of target.`,
    });
  } else {
    cards.push({
      topic: "conversion", kind: convGoal ? "trend" : "cause", confidence: "medium",
      title: `Paid conversion ${convRate}%${convGoal ? ` (goal ${convGoal}%)` : ""}`,
      detail: `${kfmt(paid)} of ${kfmt(cSig)} signups paid within 30d${convGoal && convRate >= convGoal ? " — at or above target." : "."}`,
    });
  }
  cards.push({
    topic: "churn", kind: chTrend > 0 ? "risk" : "trend", confidence: "medium",
    title: `Churn ${chTrend > 0 ? "rose" : "eased"} ${Math.abs(chTrend)}% over the window`,
    detail: `${kfmt(churnTotal)} self-serve cancellations; the monthly rate moved ${kfmt(chM[0]?.[1] ?? 0)} → ${kfmt(chM[chM.length - 1]?.[1] ?? 0)}.`,
  });
  if (icp.length > 1) {
    cards.push({
      topic: "conversion", kind: "opportunity", confidence: "medium",
      title: `A/B tiers drive ${abShare}% of paid conversions`,
      detail: `A-tier converts at ${aMult ? aMult.toFixed(1) : "~"}× the Unscored rate. Skewing acquisition toward A/B lookalikes compounds paid conversion faster than chasing raw top-of-funnel.`,
    });
  }

  const p = (opts.prompt ?? "").toLowerCase();
  const focusTopic =
    /(convert|conversion|paid|revenue)/.test(p) ? "conversion"
      : /(churn|retention|cancel)/.test(p) ? "churn"
      : /(activat|engage|onboard)/.test(p) ? "activation"
      : /(signup|traffic|growth|acqui)/.test(p) ? "signups"
      : null;
  const ordered = focusTopic
    ? [...cards].sort((a, b) => Number(b.topic === focusTopic) - Number(a.topic === focusTopic))
    : cards;
  const out: Insight[] = ordered.map((c) => ({ title: c.title, detail: c.detail, kind: c.kind, confidence: c.confidence }));

  const summary = `${focusTopic ? `Focused on ${focusTopic}. ` : ""}Across ${fmtYM(start)} – ${fmtYM(end)} (${tierLabel}): ${kfmt(signupsTotal)} signups (${sTrend >= 0 ? "+" : ""}${sTrend}%), ${actRate}% activation, ${convRate}% paid conversion, ${kfmt(churnTotal)} churned, ${kfmt(visitors)} visitors.`;

  return { summary, insights: out, range: { start, end } };
}

// --- Top-level KPIs: period totals + the equal-length previous period (for deltas).
function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type KpiSet = { signups: number; activationRate: number; conversionRate: number; churn: number };

export function kpis(opts: { start: string; icp: string[]; excludeCurrent: boolean }): {
  current: KpiSet;
  previous: KpiSet;
  prevComplete: boolean;
  periods: number;
} {
  const cutoff = currentMonthStart();
  const inIcp = (c: string) => opts.icp.includes(c);
  const current = MONTHS.filter((m) => m >= opts.start && (!opts.excludeCurrent || m < cutoff));
  const before = MONTHS.filter((m) => m < opts.start);
  const previous = before.slice(Math.max(0, before.length - current.length));

  const agg = (months: string[]): KpiSet => {
    const set = new Set(months);
    let signups = 0, orgs = 0, hit = 0, cSig = 0, paid = 0, churn = 0;
    for (const r of metrics("signups"))
      if (set.has(String(r.PERIOD)) && inIcp(String(r.ICP_SCORE))) signups += Number(r.SIGNUPS);
    for (const r of metrics("engagement"))
      if (set.has(String(r.PERIOD)) && inIcp(String(r.ICP_SCORE))) {
        orgs += Number(r.ORGS);
        hit += Number(r.W1H_1 ?? 0);
      }
    for (const r of metrics("conversion"))
      if (set.has(String(r.PERIOD)) && inIcp(String(r.ICP_SCORE))) {
        cSig += Number(r.SIGNUPS);
        paid += Number(r.PAID_WITHIN_WINDOW);
      }
    for (const r of metrics("churn"))
      if (set.has(String(r.PERIOD)) && inIcp(String(r.ICP_SCORE))) churn += Number(r.CHURNED);
    return {
      signups,
      activationRate: orgs ? Math.round((1000 * hit) / orgs) / 10 : 0,
      conversionRate: cSig ? Math.round((10000 * paid) / cSig) / 100 : 0,
      churn,
    };
  };

  return {
    current: agg(current),
    previous: agg(previous),
    prevComplete: current.length > 0 && previous.length === current.length,
    periods: current.length,
  };
}
