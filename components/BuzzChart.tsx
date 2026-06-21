"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChartMsg } from "@/components/ChartMessage";
import { ChartType, ChartTypeToggle } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";

type Row = { period: string; count: number };
type Datum = { period: string; label: string; count: number };

const kfmt = (v: unknown) => {
  const n = Number(v);
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
};

const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (period: string) => {
  const mon = mons[Number(period.slice(5, 7)) - 1] ?? period.slice(5, 7);
  return `${mon} ${Number(period.slice(8, 10))}`;
};

export function BuzzChart() {
  const { start, version } = useFilters();
  const { rows, error } = useMetrics<Row>(`/api/social?metric=buzz&start=${start}`, version);
  const [type, setType] = useState<ChartType>("bar");

  const data = useMemo<Datum[]>(
    () => (rows ?? []).map((r) => ({ period: r.period, label: fmtDay(r.period), count: r.count })),
    [rows],
  );

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" minTickGap={24} />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={kfmt} />
      <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} labelStyle={{ color: "var(--color-text-primary)", fontWeight: 500 }} formatter={(v) => [Number(v).toLocaleString(), "Mentions"]} />
    </>
  );

  return (
    <Card>
      <CardHeader
        title="Social buzz"
        subtitle="Brand mentions/day across X, Reddit, HN, Bluesky, LinkedIn"
        right={<ChartTypeToggle value={type} onChange={setType} />}
      />
      <div className="px-5 py-4" style={{ height: 320 }} role="img" aria-label="Brand mentions per day across social platforms">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !rows ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {type === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                {axes}
                <Line type="monotone" dataKey="count" name="Mentions" stroke="var(--color-active)" strokeWidth={2.5} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                {axes}
                <Bar dataKey="count" name="Mentions" fill="var(--color-active)" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
