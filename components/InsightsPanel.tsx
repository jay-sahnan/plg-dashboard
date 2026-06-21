"use client";

import { useEffect, useState } from "react";
import { Sparkles, X, RefreshCw, AlertTriangle, TrendingUp, Target, ShieldAlert, Lightbulb, ArrowUp, CalendarRange } from "lucide-react";

import { cn } from "@/lib/utils";
import { ICP_TIERS } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";

type Kind = "trend" | "cause" | "risk" | "opportunity";
type Insight = { title: string; detail: string; kind: Kind; confidence: "high" | "medium" | "low" };
type Result = { summary: string; insights: Insight[]; range: { start: string; end: string }; prompt: string };
type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; result: Result };

const KIND_META: Record<Kind, { icon: typeof TrendingUp; color: string; label: string }> = {
  trend: { icon: TrendingUp, color: "var(--color-active)", label: "Trend" },
  cause: { icon: Target, color: "var(--color-primary)", label: "Likely cause" },
  risk: { icon: ShieldAlert, color: "var(--color-error)", label: "Risk" },
  opportunity: { icon: Lightbulb, color: "var(--color-success)", label: "Opportunity" },
};

const STEERS = ["Why did conversion move?", "Focus on churn drivers", "What should we ship next?", "Is this a mix shift?"];

function fmt(ym: string) {
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m] = ym.split("-");
  return `${mons[Number(m) - 1] ?? m} '${y?.slice(2)}`;
}

export function InsightsPanel({
  open,
  onClose,
  range,
}: {
  open: boolean;
  onClose: () => void;
  range: { start: string; end: string } | null;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [prompt, setPrompt] = useState("");
  const { icp, excludeCurrent } = useFilters();
  const tierLabel = icp.length === ICP_TIERS.length ? "all tiers" : icp.length ? icp.join("/") : "no tiers";

  const run = async (r: { start: string; end: string }, steer: string) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: r.start, end: r.end, prompt: steer || undefined, icp, excludeCurrent }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error ?? `HTTP ${res.status}`);
      setState({ kind: "ready", result: { summary: d.summary, insights: d.insights ?? [], range: d.range, prompt: steer } });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };

  // When the selected range changes, reset to the "ready to analyze" prompt for
  // the new window (don't show stale results from the previous range).
  useEffect(() => {
    // Intentional: a single reset per range edit, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.kind === "loading" ? s : { kind: "idle" }));
  }, [range?.start, range?.end]);

  const submit = () => {
    if (range && state.kind !== "loading") run(range, prompt.trim());
  };

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col border-l border-border-solid bg-bg-top shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-border-faint px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="type-large text-text-primary">AI Insights</h2>
          </div>
          <p className="type-caption mt-1 text-text-tertiary">
            {range ? `${fmt(range.start)} – ${fmt(range.end)} · ${tierLabel}` : "Select a range"}
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary">
          <X size={16} />
        </button>
      </header>

      {/* Steer the analysis */}
      <div className="border-b border-border-faint px-5 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Steer the analysis (optional)… e.g. focus on what drove the conversion dip"
            className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border border-border-solid bg-bg-main px-3 py-2 type-body text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!range || state.kind === "loading"}
            className="flex size-[38px] shrink-0 items-center justify-center rounded-md border border-primary bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            title="Generate insights"
          >
            {state.kind === "loading" ? <RefreshCw size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STEERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setPrompt(s);
                if (range && state.kind !== "loading") run(range, s);
              }}
              className="rounded-full border border-border-faint px-2.5 py-1 type-caption text-text-secondary transition-colors hover:border-primary hover:text-text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {state.kind === "loading" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 type-body text-text-secondary">
              <Sparkles size={14} className="animate-pulse text-primary" />
              Reading the funnel + changelog for this window…
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-bg-subtle" />
            ))}
          </div>
        ) : state.kind === "error" ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-medium bg-bg-subtle px-6 py-10 text-center">
            <AlertTriangle className="text-error" size={22} />
            <p className="type-body text-text-secondary">Insights failed: {state.message}</p>
            {range ? (
              <button onClick={submit} className="mt-2 rounded-md border border-border-solid px-3 py-1.5 type-caption text-text-primary hover:bg-bg-layered">
                Try again
              </button>
            ) : null}
          </div>
        ) : state.kind === "ready" ? (
          <div className="space-y-4">
            {state.result.prompt ? (
              <p className="type-caption text-text-tertiary">
                Steered by: <span className="text-text-secondary">“{state.result.prompt}”</span>
              </p>
            ) : null}
            {state.result.summary ? (
              <p className="type-base rounded-lg border border-border-faint bg-bg-subtle px-4 py-3 text-text-primary">{state.result.summary}</p>
            ) : null}
            {state.result.insights.map((ins, i) => {
              const meta = KIND_META[ins.kind] ?? KIND_META.trend;
              const Icon = meta.icon;
              return (
                <div key={i} className="rounded-lg border border-border-faint bg-bg-main p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
                      <Icon size={15} style={{ color: meta.color }} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="type-body font-medium text-text-primary">{ins.title}</h3>
                        <span className="type-caption rounded px-1.5 py-0.5" style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className={cn("type-caption", ins.confidence === "high" ? "text-success" : ins.confidence === "low" ? "text-text-tertiary" : "text-alert")}>
                          {ins.confidence} confidence
                        </span>
                      </div>
                      <p className="type-base mt-1 text-text-secondary">{ins.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {state.result.insights.length === 0 ? <p className="type-body text-text-tertiary">No insights returned for this window.</p> : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-medium bg-bg-subtle px-6 py-10 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <CalendarRange size={18} className="text-primary" />
            </span>
            {range ? (
              <>
                <p className="type-body text-text-secondary">Ready to analyze</p>
                <p className="type-large text-text-primary">{fmt(range.start)} – {fmt(range.end)}</p>
                <p className="type-caption text-text-tertiary">
                  Add a question above (optional), then press <ArrowUp size={11} className="-mt-0.5 inline" /> or Enter to generate insights.
                </p>
              </>
            ) : (
              <p className="type-body text-text-secondary">Drag across a chart or pick a period, then ask.</p>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-border-faint px-5 py-3 type-caption text-text-tertiary">
        Generated by Claude Opus 4.8 from your funnel data + goals. Always sanity-check against the charts.
      </footer>
    </aside>
  );
}
