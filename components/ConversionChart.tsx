"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { CardHeader } from "@/components/ui/Card";
import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
import { ChartMsg } from "@/components/ChartMessage";
import { ICP_COLORS, ICP_TIERS, ChartType, ChartTypeToggle, currentBucketStart, fmtPeriod, goalAwareLabel, useDragSelect, usePulse } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";

type Row = { PERIOD: string; ICP_SCORE: string; SIGNUPS: number; ACTIVATED: number; PAID_WITHIN_WINDOW: number };
type Datum = Record<string, number | string>;
type Denom = "all" | "activated";

const r2 = (v: number) => Math.round(v * 100) / 100;

export function ConversionChart() {
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
  const [type, setType] = useState<ChartType>("line");
  const [denom, setDenom] = useState<Denom>("all");
  const pulse = usePulse(`${icp.join(",")}|${icpBreakdown}|${excludeCurrent}|${start}|${grain}|${version}`);
  const { rows: raw, error, meta } = useMetrics<Row>(
    `/api/metrics?section=conversion&start=${start}&grain=${grain}`,
    version,
  );

  const tiers = ICP_TIERS.filter((t) => icp.includes(t));

  const { data, breakdown } = useMemo(() => {
    if (!raw) return { data: [] as Datum[], breakdown: [] as Datum[] };
    const cutoff = currentBucketStart(grain);
    const byP = new Map<string, Map<string, { s: number; a: number; p: number }>>();
    for (const r of raw) {
      if (!icp.includes(r.ICP_SCORE)) continue;
      if (excludeCurrent && r.PERIOD >= cutoff) continue;
      const tm = byP.get(r.PERIOD) ?? new Map<string, { s: number; a: number; p: number }>();
      const t = tm.get(r.ICP_SCORE) ?? { s: 0, a: 0, p: 0 };
      t.s += Number(r.SIGNUPS);
      t.a += Number(r.ACTIVATED);
      t.p += Number(r.PAID_WITHIN_WINDOW);
      tm.set(r.ICP_SCORE, t);
      byP.set(r.PERIOD, tm);
    }
    const periods = [...byP.keys()].sort();
    const base = (x: { s: number; a: number }) => (denom === "all" ? x.s : x.a);
    const data = periods.map((period) => {
      const tm = byP.get(period)!;
      let s = 0, a = 0, p = 0;
      for (const t of tm.values()) {
        s += t.s;
        a += t.a;
        p += t.p;
      }
      return { period: fmtPeriod(period, grain), ym: period.slice(0, 7), pctAll: s ? r2((100 * p) / s) : 0, pctActivated: a ? r2((100 * p) / a) : 0, signups: s, activated: a, paid: p };
    });
    const breakdown = periods.map((period) => {
      const tm = byP.get(period)!;
      const row: Datum = { period: fmtPeriod(period, grain), ym: period.slice(0, 7) };
      for (const t of tiers) {
        const x = tm.get(t);
        const b = x ? base(x) : 0;
        row[t] = x && b ? r2((100 * x.p) / b) : 0;
      }
      return row;
    });
    return { data, breakdown };
  }, [raw, icp, excludeCurrent, grain, denom, tiers]);

  const { dragProps, refArea } = useDragSelect(
    data as { period: string; ym: string }[],
    onSelectMonth,
    onSelectRange,
    selectedRange,
  );

  const mkey = denom === "all" ? "pctAll" : "pctActivated";
  const seriesName = denom === "all" ? "Paid within 30d (of signups)" : "Paid within 30d (of activated)";
  const pctLabel = (v: unknown) => `${v}%`;
  const chartData = icpBreakdown ? breakdown : data;

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" vertical={false} />
      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={(v) => `${v}%`} />
      <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} labelStyle={{ color: "var(--color-text-primary)", fontWeight: 500 }} formatter={(v) => `${v}%`} />
    </>
  );

  const goalLine = goals.conversion ? (
    <ReferenceLine y={goals.conversion} stroke="var(--color-text-secondary)" strokeDasharray="5 4" strokeWidth={1.5} />
  ) : null;

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Paid conversion"
        subtitle={
          (icpBreakdown
            ? `% paid within 30d ${denom === "all" ? "of signups" : "of activated"}, split by account tier · matured cohorts`
            : denom === "all"
              ? "% of signup cohort (org, non-Enterprise) paid within 30d · matured cohorts only"
              : "% of ACTIVATED orgs (first API session ≤1h) paid within 30d · matured cohorts only") +
          (selectedMonth ? ` · timeline filtered to ${selectedMonth}` : " · click a month to filter →")
        }
        right={
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-md border border-border-faint">
              {(["all", "activated"] as const).map((d) => (
                <button key={d} onClick={() => setDenom(d)} aria-pressed={denom === d} className={cn("px-2.5 py-1 type-caption transition-colors", denom === d ? "bg-bg-layered text-text-primary" : "text-text-tertiary hover:text-text-secondary")}>
                  {d === "all" ? "All signups" : "Activated"}
                </button>
              ))}
            </div>
            <ChartTypeToggle value={type} onChange={setType} />
          </div>
        }
      />
      <div className={`px-5 py-4 transition-opacity duration-200 ${pulse ? "opacity-30" : ""}`} style={{ height: 360 }} role="img" aria-label="Paid conversion rate over time">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !raw ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {type === "line" ? (
              <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 0, left: -8 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {icpBreakdown ? (
                  tiers.map((t) => (
                    <Line key={t} type="monotone" dataKey={t} name={t} stroke={ICP_COLORS[t]} strokeWidth={2.5} dot={{ r: 2 }} />
                  ))
                ) : (
                  <Line type="monotone" dataKey={mkey} name={seriesName} stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }}>
                    <LabelList dataKey={mkey} position="top" offset={10} formatter={pctLabel} style={{ fontSize: 11, fill: "var(--color-text-secondary)", fontWeight: 500 }} />
                  </Line>
                )}
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 16, right: 24, bottom: 0, left: -8 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {icpBreakdown ? (
                  tiers.map((t) => <Bar key={t} dataKey={t} name={t} fill={ICP_COLORS[t]} radius={[3, 3, 0, 0]} cursor="pointer" />)
                ) : (
                  <Bar dataKey={mkey} name={seriesName} fill="var(--color-primary)" radius={[3, 3, 0, 0]} cursor="pointer">
                    <LabelList dataKey={mkey} content={goalAwareLabel(goals.conversion, pctLabel)} />
                  </Bar>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
