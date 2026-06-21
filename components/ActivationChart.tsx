"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Legend,
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

type Row = { PERIOD: string; ICP_SCORE: string; ORGS: number } & Record<string, number | string>;
type Datum = Record<string, number | string>;

// Two dropdowns parameterize ONE metric: % of orgs that ran >=<sessions>
// real sessions within <window> of signup. Column = W{window}_{sessions}.
const TIME_OPTS = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];
const SESS_OPTS = [
  { key: "1", label: "1+ session" },
  { key: "5", label: "5+ sessions" },
  { key: "10", label: "10+ sessions" },
  { key: "100", label: "100+ sessions" },
];
const LINE_COLOR = "#dd7e6b";
const rate = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export function ActivationChart() {
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
  const [timeKey, setTimeKey] = useState<string>("1h");
  const [sessKey, setSessKey] = useState<string>("1");

  const field = `W${timeKey.toUpperCase()}_${sessKey}`; // e.g. W1H_1, W24H_5
  const timeLabel = TIME_OPTS.find((o) => o.key === timeKey)?.label ?? timeKey;
  const sessLabel = SESS_OPTS.find((o) => o.key === sessKey)?.label ?? sessKey;
  const metricLabel = `${sessLabel} ≤ ${timeLabel}`;
  const tiers = ICP_TIERS.filter((t) => icp.includes(t));
  const pulse = usePulse(`${field}|${icp.join(",")}|${icpBreakdown}|${excludeCurrent}|${start}|${grain}|${version}`);
  const { rows: raw, error, meta } = useMetrics<Row>(
    `/api/metrics?section=engagement&start=${start}&grain=${grain}`,
    version,
  );

  const { data, breakdown } = useMemo(() => {
    if (!raw) return { data: [] as Datum[], breakdown: [] as Datum[] };
    const cutoff = currentBucketStart(grain);
    const byP = new Map<string, Map<string, { orgs: number; hit: number }>>();
    for (const r of raw) {
      if (!icp.includes(r.ICP_SCORE)) continue;
      if (excludeCurrent && r.PERIOD >= cutoff) continue;
      const tm = byP.get(r.PERIOD) ?? new Map<string, { orgs: number; hit: number }>();
      const t = tm.get(r.ICP_SCORE) ?? { orgs: 0, hit: 0 };
      t.orgs += Number(r.ORGS);
      t.hit += Number(r[field] ?? 0);
      tm.set(r.ICP_SCORE, t);
      byP.set(r.PERIOD, tm);
    }
    const periods = [...byP.keys()].sort();
    const data = periods.map((period) => {
      const tm = byP.get(period)!;
      let orgs = 0, hit = 0;
      for (const t of tm.values()) {
        orgs += t.orgs;
        hit += t.hit;
      }
      return { period: fmtPeriod(period, grain), ym: period.slice(0, 7), value: rate(hit, orgs) };
    });
    const breakdown = periods.map((period) => {
      const tm = byP.get(period)!;
      const row: Datum = { period: fmtPeriod(period, grain), ym: period.slice(0, 7) };
      for (const t of tiers) {
        const x = tm.get(t);
        row[t] = x ? rate(x.hit, x.orgs) : 0;
      }
      return row;
    });
    return { data, breakdown };
  }, [raw, icp, excludeCurrent, grain, field, tiers]);

  const { dragProps, refArea } = useDragSelect(data as { period: string; ym: string }[], onSelectMonth, onSelectRange, selectedRange);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" vertical={false} />
      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={(v) => `${v}%`} />
      <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} labelStyle={{ color: "var(--color-text-primary)", fontWeight: 500 }} formatter={(v) => `${v}%`} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  const subtitle = icpBreakdown
    ? `% of orgs that ran ${metricLabel} of signup, split by account tier${selectedMonth ? ` · filtered to ${selectedMonth}` : ""}`
    : `% of orgs that ran ${metricLabel} of signup${selectedMonth ? ` · filtered to ${selectedMonth}` : " · click a month to filter →"}`;

  const selStyle = "rounded-md border border-border-solid bg-bg-top px-2.5 py-1.5 type-caption text-text-primary";

  const goalLine = goals.activation ? (
    <ReferenceLine y={goals.activation} stroke="var(--color-text-secondary)" strokeDasharray="5 4" strokeWidth={1.5} />
  ) : null;

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Activation & engagement"
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1.5 type-caption text-text-tertiary">
              Sessions
              <select value={sessKey} onChange={(e) => setSessKey(e.target.value)} className={selStyle}>
                {SESS_OPTS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 type-caption text-text-tertiary">
              within
              <select value={timeKey} onChange={(e) => setTimeKey(e.target.value)} className={selStyle}>
                {TIME_OPTS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
            <ChartTypeToggle value={type} onChange={setType} />
          </div>
        }
      />
      <div className={`px-5 py-4 transition-opacity duration-200 ${pulse ? "opacity-30" : ""}`} style={{ height: 360 }} role="img" aria-label="Activation and engagement rate over time">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !raw ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {type === "bar" ? (
              <BarChart data={icpBreakdown ? breakdown : data} margin={{ top: 8, right: 24, bottom: 0, left: -8 }} barCategoryGap="20%" {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {icpBreakdown ? (
                  tiers.map((t) => <Bar key={t} dataKey={t} name={t} fill={ICP_COLORS[t]} radius={[3, 3, 0, 0]} cursor="pointer" />)
                ) : (
                  <Bar dataKey="value" name={metricLabel} fill={LINE_COLOR} radius={[3, 3, 0, 0]} cursor="pointer">
                    <LabelList dataKey="value" content={goalAwareLabel(goals.activation, (v) => `${v}%`)} />
                  </Bar>
                )}
              </BarChart>
            ) : (
              <LineChart data={icpBreakdown ? breakdown : data} margin={{ top: 8, right: 24, bottom: 0, left: -8 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                {icpBreakdown ? (
                  tiers.map((t) => (
                    <Line key={t} type="monotone" dataKey={t} name={t} stroke={ICP_COLORS[t]} strokeWidth={2.5} dot={{ r: 3 }} />
                  ))
                ) : (
                  <Line type="monotone" dataKey="value" name={metricLabel} stroke={LINE_COLOR} strokeWidth={2.5} dot={{ r: 3 }} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
