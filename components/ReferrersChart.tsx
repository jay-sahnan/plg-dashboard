"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardHeader } from "@/components/ui/Card";
import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
import { ChartMsg } from "@/components/ChartMessage";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";

type Row = { referrer: string; visitors: number };

const kfmt = (v: unknown) => {
  const n = Number(v);
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
};
const label = (r: string) => (r === "$direct" ? "Direct / none" : r.replace(/^www\./, ""));

export function ReferrersChart() {
  const { start, version } = useFilters();
  const { rows, error, meta } = useMetrics<Row>(`/api/web?metric=referrers&start=${start}`, version);

  const data = useMemo<Row[]>(
    () => (rows ?? []).map((r) => ({ referrer: label(r.referrer), visitors: r.visitors })),
    [rows],
  );

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Top referrers"
        subtitle="Unique visitors by referring domain, over the selected period — where traffic comes from"
      />
      <div className="px-5 py-4" style={{ height: 320 }} role="img" aria-label="Unique visitors by referring domain">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !rows ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={kfmt} />
              <YAxis type="category" dataKey="referrer" width={130} tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} stroke="var(--color-border-medium)" />
              <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} formatter={(v) => [Number(v).toLocaleString(), "Visitors"]} />
              <Bar dataKey="visitors" fill="var(--color-active)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
