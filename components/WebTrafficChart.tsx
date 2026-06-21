"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { ChartType, ChartTypeToggle, currentBucketStart, fmtPeriod, useDragSelect } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";

type Row = { period: string; pageviews: number; visitors: number };
type Datum = { period: string; ym: string; pageviews: number; visitors: number };

const kfmt = (v: unknown) => {
  const n = Number(v);
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
};

export function WebTrafficChart() {
  const { start, grain, excludeCurrent, version, goals, selectedRange, onSelectMonth, onSelectRange } = useFilters();
  const { rows, error, meta } = useMetrics<Row>(`/api/web?metric=traffic&start=${start}&grain=${grain}`, version);
  const [type, setType] = useState<ChartType>("line");

  const data = useMemo<Datum[]>(() => {
    if (!rows) return [];
    const cutoff = currentBucketStart(grain);
    return rows
      .filter((r) => !excludeCurrent || r.period < cutoff)
      .map((r) => ({ period: fmtPeriod(r.period, grain), ym: r.period.slice(0, 7), pageviews: r.pageviews, visitors: r.visitors }));
  }, [rows, grain, excludeCurrent]);

  const { dragProps, refArea } = useDragSelect(data, onSelectMonth, onSelectRange, selectedRange);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" vertical={false} />
      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={kfmt} />
      <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} labelStyle={{ color: "var(--color-text-primary)", fontWeight: 500 }} formatter={(v) => Number(v).toLocaleString()} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  const goalLine = goals.visitors ? (
    <ReferenceLine y={goals.visitors} stroke="var(--color-text-secondary)" strokeDasharray="5 4" strokeWidth={1.5} />
  ) : null;

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Web traffic"
        subtitle="Unique visitors & pageviews on your site. Switch to Week to see the launch spike."
        right={<ChartTypeToggle value={type} onChange={setType} />}
      />
      <div className="px-5 py-4" style={{ height: 320 }} role="img" aria-label="Unique visitors and pageviews over time">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !rows ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {type === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 4 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                <Line type="monotone" dataKey="visitors" name="Visitors" stroke="var(--color-active)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="pageviews" name="Pageviews" stroke="var(--color-text-tertiary)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 4 }} {...dragProps} style={{ cursor: "crosshair" }}>
                {axes}
                {refArea}
                {goalLine}
                <Bar dataKey="visitors" name="Visitors" fill="var(--color-active)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pageviews" name="Pageviews" fill="var(--color-border-medium)" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
