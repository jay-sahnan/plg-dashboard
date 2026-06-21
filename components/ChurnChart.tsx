"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CardHeader } from "@/components/ui/Card";
import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
import { ChartMsg } from "@/components/ChartMessage";
import { ICP_COLORS, ICP_TIERS, ChartType, ChartTypeToggle, currentBucketStart, fmtPeriod, goalAwareLabel, useDragSelect, usePulse } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";
import { scaleGoalToGrain } from "@/lib/goalsConfig";

type Row = { PERIOD: string; PLAN_TIER: string; ICP_SCORE: string; CHURNED: number };
type Datum = Record<string, number | string>;

const TIERS = ["Hobby ($20)", "Startup ($99)"] as const;
const COLORS: Record<string, string> = { "Hobby ($20)": "#ec679b", "Startup ($99)": "#9c71f0" };

export function ChurnChart() {
  const {
    start,
    grain,
    excludeCurrent,
    icp,
    icpBreakdown,
    version,
    goals,
    selectedMonth,
    selectedRange,
    onSelectMonth,
    onSelectRange,
  } = useFilters();
  const [type, setType] = useState<ChartType>("bar");
  const pulse = usePulse(`${icp.join(",")}|${icpBreakdown}|${excludeCurrent}|${start}|${grain}|${version}`);
  const { rows: raw, error, meta } = useMetrics<Row>(
    `/api/metrics?section=churn&start=${start}&grain=${grain}`,
    version,
  );

  const tiers = ICP_TIERS.filter((t) => icp.includes(t));
  const { data, total } = useMemo(() => {
    if (!raw) return { data: [] as Datum[], total: 0 };
    const cutoff = currentBucketStart(grain);
    const byPeriod = new Map<string, Datum>();
    let total = 0;
    for (const r of raw) {
      if (!icp.includes(r.ICP_SCORE)) continue;
      if (excludeCurrent && r.PERIOD >= cutoff) continue;
      if (!r.PLAN_TIER) continue;
      const p = byPeriod.get(r.PERIOD) ?? { period: fmtPeriod(r.PERIOD, grain), ym: r.PERIOD.slice(0, 7), total: 0 };
      const key = icpBreakdown ? r.ICP_SCORE : r.PLAN_TIER;
      p[key] = Number(p[key] ?? 0) + Number(r.CHURNED);
      p.total = Number(p.total ?? 0) + Number(r.CHURNED);
      total += Number(r.CHURNED);
      byPeriod.set(r.PERIOD, p);
    }
    return { data: [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v), total };
  }, [raw, icp, icpBreakdown, excludeCurrent, grain]);

  const series = icpBreakdown
    ? tiers.map((t) => ({ key: t, name: t, color: ICP_COLORS[t]! }))
    : TIERS.map((t) => ({ key: t, name: t, color: COLORS[t]! }));
  const lastKey = series[series.length - 1]?.key;

  const { dragProps, refArea } = useDragSelect(
    data as { period: string; ym: string }[],
    onSelectMonth,
    onSelectRange,
    selectedRange,
  );

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" vertical={false} />
      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" />
      <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} labelStyle={{ color: "var(--color-text-primary)", fontWeight: 500 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  const churnGoal = goals.churn ? scaleGoalToGrain(goals.churn, grain) : 0;
  const goalLine = churnGoal ? (
    <ReferenceLine y={churnGoal} stroke="var(--color-text-secondary)" strokeDasharray="5 4" strokeWidth={1.5} />
  ) : null;

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Churn"
        subtitle={
          selectedMonth
            ? `Self-serve cancellations by ${icpBreakdown ? "account tier" : "plan"} · timeline filtered to ${selectedMonth}`
            : icpBreakdown
              ? "Self-serve cancellations split by account tier per period · click a month to filter →"
              : "Self-serve cancellations (Hobby $20 / Startup $99) per period · click a month to filter →"
        }
        right={
          <div className="flex items-center gap-3">
            {raw ? <span className="type-caption text-text-tertiary">{total.toLocaleString()} in view</span> : null}
            <ChartTypeToggle value={type} onChange={setType} />
          </div>
        }
      />
      <div className={`px-5 py-4 transition-opacity duration-200 ${pulse ? "opacity-30" : ""}`} style={{ height: 360 }} role="img" aria-label="Churn by plan or account tier over time">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !raw ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {type === "bar" ? (
              <BarChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: -8 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.name} stackId="churn" fill={s.color} radius={s.key === lastKey ? [3, 3, 0, 0] : undefined} cursor="pointer">
                    {s.key === lastKey && <LabelList dataKey="total" content={goalAwareLabel(churnGoal || undefined, undefined, { offset: 8, fontWeight: 500 })} />}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: -8 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {series.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
