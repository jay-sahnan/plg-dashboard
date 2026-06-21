"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { useFilters } from "@/components/DashboardFilters";
import { useMetrics } from "@/lib/hooks/useMetrics";
import { cn } from "@/lib/utils";

type KpiSet = { signups: number; activationRate: number; conversionRate: number; churn: number };
type Summary = { current: KpiSet; previous: KpiSet; prevComplete: boolean; periods: number };

type CardDef = {
  key: keyof KpiSet;
  goalKey: string;
  label: string;
  fmt: (v: number) => string;
  kind: "count" | "rate";
  upIsGood: boolean;
};

const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

const CARDS: CardDef[] = [
  { key: "signups", goalKey: "signups", label: "Total signups", fmt: (v) => v.toLocaleString(), kind: "count", upIsGood: true },
  { key: "activationRate", goalKey: "activation", label: "Avg activation", fmt: (v) => `${v}%`, kind: "rate", upIsGood: true },
  { key: "conversionRate", goalKey: "conversion", label: "Avg paid conversion", fmt: (v) => `${v}%`, kind: "rate", upIsGood: true },
  { key: "churn", goalKey: "churn", label: "Total churn", fmt: (v) => v.toLocaleString(), kind: "count", upIsGood: false },
];

function computeDelta(cur: number, prev: number, kind: "count" | "rate", upIsGood: boolean) {
  if (kind === "rate") {
    const diff = Math.round((cur - prev) * 10) / 10; // percentage points
    return { text: `${diff > 0 ? "+" : ""}${diff}pp`, up: diff > 0, flat: diff === 0, good: (diff > 0) === upIsGood };
  }
  if (!prev) return { text: cur > 0 ? "new" : "0%", up: cur > 0, flat: cur === 0, good: cur > 0 ? upIsGood : true };
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, up: pct > 0, flat: pct === 0, good: (pct > 0) === upIsGood };
}

export function KpiRow() {
  const { start, icp, excludeCurrent, periodLabel, version, goals } = useFilters();
  const url = `/api/kpis?start=${start}&excludeCurrent=${excludeCurrent ? "1" : "0"}&icp=${icp.join(",")}`;
  const { rows, error } = useMetrics<Summary>(url, version);
  const data = rows?.[0];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((c) => {
        const cur = data?.current[c.key];
        const d =
          data && data.prevComplete ? computeDelta(data.current[c.key], data.previous[c.key], c.kind, c.upIsGood) : null;

        // Goal is a per-period target: rates compare directly; counts compare the
        // period average (total / number of periods).
        const goal = goals[c.goalKey];
        let goalNote: { met: boolean; text: string } | null = null;
        if (goal && data) {
          const per = c.kind === "count" ? (data.periods ? data.current[c.key] / data.periods : 0) : data.current[c.key];
          const met = c.upIsGood ? per >= goal : per <= goal;
          goalNote = { met, text: `Goal ${c.kind === "rate" ? `${goal}%` : `${kfmt(goal)}/period`}` };
        }

        return (
          <Card key={c.key} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="type-caption text-text-tertiary">{c.label}</p>
              {d ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 type-caption font-medium",
                    d.flat ? "bg-bg-layered text-text-tertiary" : d.good ? "bg-success/10 text-success" : "bg-error/10 text-error",
                  )}
                  title="vs previous period"
                >
                  {d.flat ? null : d.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {d.text}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-text-primary">
              {error ? "—" : cur === undefined ? "…" : c.fmt(cur)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 type-caption">
              <span className="text-text-tertiary">{periodLabel}</span>
              {goalNote ? (
                <span className={cn("inline-flex items-center gap-1", goalNote.met ? "text-success" : "text-text-tertiary")}>
                  {goalNote.met ? <Check size={12} /> : null}
                  {goalNote.text}
                </span>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
