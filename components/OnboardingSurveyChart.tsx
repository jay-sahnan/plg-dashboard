"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardHeader } from "@/components/ui/Card";
import { ProvenanceCard } from "@/components/ui/ProvenanceCard";
import { ChartMsg } from "@/components/ChartMessage";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";

type Row = { option: string; n: number };

const kfmt = (v: unknown) => {
  const n = Number(v);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
};

export function OnboardingSurveyChart() {
  const { start, version } = useFilters();
  const { rows, error, meta } = useMetrics<Row>(`/api/web?metric=survey&start=${start}`, version);
  const data = rows ?? [];

  return (
    <ProvenanceCard meta={meta}>
      <CardHeader
        title="Onboarding survey"
        subtitle="“What are you building?” responses (multi-select) — self-reported use case at signup"
      />
      <div className="px-5 py-4" style={{ height: 320 }} role="img" aria-label="Onboarding survey responses by use case">
        {error ? (
          <ChartMsg icon="error" text={`Query failed: ${error}`} />
        ) : !rows ? (
          <ChartMsg icon="load" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} stroke="var(--color-border-medium)" tickFormatter={kfmt} />
              <YAxis type="category" dataKey="option" width={120} tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} stroke="var(--color-border-medium)" />
              <Tooltip contentStyle={{ background: "var(--color-bg-top)", border: "1px solid var(--color-border-medium)", borderRadius: 6, fontSize: 13 }} formatter={(v) => [Number(v).toLocaleString(), "Responses"]} />
              <Bar dataKey="n" fill="var(--color-brand-green)" radius={[0, 3, 3, 0]}>
                <LabelList dataKey="n" position="right" formatter={kfmt} style={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ProvenanceCard>
  );
}
