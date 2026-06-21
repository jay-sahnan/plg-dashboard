"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ReferenceArea, useYAxisScale, type LabelProps } from "recharts";

import { cn } from "@/lib/utils";

export type ChartType = "bar" | "line";
export type Grain = "month" | "week";

const pad = (n: number) => String(n).padStart(2, "0");

/** Bucket start (YYYY-MM-DD) of the current month or week (Monday-based). */
export function currentBucketStart(grain: Grain): string {
  const d = new Date();
  if (grain === "week") {
    const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - dow);
  } else {
    d.setDate(1);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Format a YYYY-MM-DD bucket start for the X axis. */
export function fmtPeriod(period: string, grain: Grain): string {
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = [period.slice(0, 4), period.slice(5, 7), period.slice(8, 10)];
  const mon = mons[Number(m) - 1] ?? m;
  return grain === "week" ? `${mon} ${Number(d)}` : `${mon} '${y.slice(2)}`;
}

// A bar-top label that lifts itself clear of a horizontal goal line when the bar
// top lands close enough that the text would otherwise sit on the dashes. Works
// for plain and stacked bars: it reads the bar/stack top from the label viewBox
// and gets the goal line's pixel y straight from the live Y-axis scale (so it's
// correct regardless of stacking, axis domain, or zero baseline).
const LABEL_FONT = 11;
const LABEL_CLEARANCE = 7; // px the label keeps above the goal line when bumped
export function goalAwareLabel(
  goal: number | undefined,
  fmt?: (v: unknown) => string,
  opts: { offset?: number; fontWeight?: number } = {},
) {
  const gap = opts.offset ?? 6; // default distance above the bar top
  return function GoalAwareLabel(props: LabelProps) {
    const yScale = useYAxisScale();
    const value = props.value;
    if (typeof value !== "number" && typeof value !== "string") return null;
    const vb = (props.viewBox ?? {}) as { x?: number; y?: number; width?: number };
    const x = Number(vb.x), y = Number(vb.y), w = Number(vb.width);
    let ty = y - gap; // text baseline, just above the bar/stack top
    if (goal && yScale) {
      const goalPx = Number(yScale(goal));
      // text box spans roughly [ty - FONT, ty]; if the line cuts through it, lift clear
      if (Number.isFinite(goalPx) && goalPx >= ty - LABEL_FONT - 2 && goalPx <= ty + 2) {
        ty = goalPx - LABEL_CLEARANCE;
      }
    }
    return (
      <text x={x + w / 2} y={ty} textAnchor="middle" style={{ fontSize: LABEL_FONT, fontWeight: opts.fontWeight, fill: "var(--color-text-secondary)" }}>
        {fmt ? fmt(value) : value}
      </text>
    );
  };
}

export const PERIODS: { label: string; start?: string; months?: number }[] = [
  { label: "All time", start: "2020-01-01" },
  { label: "Since Apr '25", start: "2025-04-01" },
  { label: "Last 12 months", months: 12 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 3 months", months: 3 },
];

export function startForPeriod(p: { start?: string; months?: number }): string {
  if (p.start) return p.start;
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - ((p.months ?? 12) - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function ChartTypeToggle({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (t: ChartType) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border-faint">
      {(["bar", "line"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          aria-pressed={value === t}
          aria-label={`${t} chart`}
          className={cn(
            "px-2.5 py-1 type-caption capitalize transition-colors",
            value === t ? "bg-bg-layered text-text-primary" : "text-text-tertiary hover:text-text-secondary",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function GrainToggle({
  value,
  onChange,
}: {
  value: Grain;
  onChange: (g: Grain) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border-faint">
      {(["month", "week"] as const).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          aria-label={`Group by ${g}`}
          className={cn(
            "px-2.5 py-1.5 type-body capitalize transition-colors",
            value === g ? "bg-bg-layered text-text-primary" : "text-text-tertiary hover:text-text-secondary",
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

export function ExcludeCurrentToggle({
  value,
  onChange,
  grain,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  grain: Grain;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 type-body transition-colors",
        value ? "border-primary bg-primary/10 text-text-primary" : "border-border-solid bg-bg-top text-text-secondary hover:bg-bg-layered",
      )}
      title={`Drop the in-progress current ${grain} (it's partial)`}
    >
      <span className={cn("size-3.5 rounded-sm border", value ? "border-primary bg-primary" : "border-border-medium")} />
      Exclude current {grain}
    </button>
  );
}

/** Briefly returns true whenever `key` changes (skips first render) — a quick
 * "redrawing" cue for client-side filter changes that are otherwise instant. */
export function usePulse(key: string, ms = 280): boolean {
  const [pulse, setPulse] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return pulse;
}

/** Drag across a time-series chart to select a month range; single click falls
 * back to month-filter. Returns mouse handlers to spread on the chart + a
 * <ReferenceArea> to render inside it for the live highlight. */
export function useDragSelect(
  data: { period: string; ym: string }[],
  onClickMonth?: (ym: string) => void,
  onSelectRange?: (start: string, end: string) => void,
  selectedRange?: { start: string; end: string } | null,
) {
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);

  const down = (e: { activeLabel?: string | number } | null) => {
    if (e?.activeLabel != null) {
      setA(String(e.activeLabel));
      setB(String(e.activeLabel));
    }
  };
  const move = (e: { activeLabel?: string | number } | null) => {
    if (a != null && e?.activeLabel != null) setB(String(e.activeLabel));
  };
  const finish = () => {
    if (a != null && b != null) {
      if (a === b) {
        const ym = data.find((d) => d.period === a)?.ym;
        if (ym) onClickMonth?.(ym);
      } else {
        const i = data.findIndex((d) => d.period === a);
        const j = data.findIndex((d) => d.period === b);
        const [lo, hi] = i <= j ? [i, j] : [j, i];
        const s = data[lo]?.ym;
        const e = data[hi]?.ym;
        if (s && e) onSelectRange?.(s, e);
      }
    }
    setA(null);
    setB(null);
  };

  // While dragging show the live band; once committed, keep the selected range
  // highlighted (mapped from ym back to this chart's x-axis labels) so it persists.
  let refArea: ReactNode = null;
  if (a != null && b != null && a !== b) {
    refArea = <ReferenceArea x1={a} x2={b} strokeOpacity={0} fill="var(--color-primary)" fillOpacity={0.12} />;
  } else if (selectedRange) {
    const sp = data.find((d) => d.ym === selectedRange.start)?.period;
    const ep = data.find((d) => d.ym === selectedRange.end)?.period;
    if (sp && ep) {
      refArea = (
        <ReferenceArea x1={sp} x2={ep} stroke="var(--color-primary)" strokeOpacity={0.45} strokeDasharray="3 3" fill="var(--color-primary)" fillOpacity={0.1} />
      );
    }
  }

  return {
    dragProps: { onMouseDown: down, onMouseMove: move, onMouseUp: finish },
    refArea,
  };
}

export const ICP_TIERS = ["A", "B", "C", "Unscored"] as const;
export const ICP_COLORS: Record<string, string> = {
  A: "var(--color-icp-a)",
  B: "var(--color-icp-b)",
  C: "var(--color-icp-c)",
  Unscored: "var(--color-icp-unscored)",
};

/** Top-level ICP-score multi-select dropdown. Filtering is client-side (instant). */
export function IcpFilter({
  value,
  onChange,
  breakdown = false,
  onBreakdownChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  breakdown?: boolean;
  onBreakdownChange?: (b: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const all = value.length === ICP_TIERS.length;
  const label = (all ? "All" : value.length === 0 ? "None" : value.join(", ")) + (breakdown ? " · split" : "");

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        e.stopPropagation(); // don't let a page-level Esc handler also fire
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Filter by account tier"
        title="Filter accounts by lead-quality tier (A/B/C or Unscored)"
        className="flex items-center gap-2 rounded-md border border-border-solid bg-bg-top px-3 py-1.5 type-body text-text-primary transition-colors hover:bg-bg-layered"
      >
        <span className="type-caption text-text-tertiary">Account tier</span>
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown size={14} className="text-text-tertiary" />
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-52 rounded-md border border-border-solid bg-bg-top p-1 shadow-sm">
          {onBreakdownChange ? (
            <button
              onClick={() => onBreakdownChange(!breakdown)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left type-body transition-colors hover:bg-bg-layered"
            >
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", breakdown ? "border-primary bg-primary text-white" : "border-border-medium")}>
                {breakdown ? <Check size={11} /> : null}
              </span>
              Break down by tier
            </button>
          ) : null}
          <div className="my-1 h-px bg-border-faint" />
          <button
            onClick={() => onChange(all ? [] : [...ICP_TIERS])}
            className="w-full rounded px-2 py-1.5 text-left type-caption text-text-secondary transition-colors hover:bg-bg-layered"
          >
            {all ? "Clear all" : "Select all"}
          </button>
          {ICP_TIERS.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left type-body transition-colors hover:bg-bg-layered"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  value.includes(t) ? "border-primary bg-primary text-white" : "border-border-medium",
                )}
              >
                {value.includes(t) ? <Check size={11} /> : null}
              </span>
              <span className="size-2.5 rounded-full" style={{ background: ICP_COLORS[t] }} />
              {t}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PeriodSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (label: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 type-caption text-text-tertiary">
      Period
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border-solid bg-bg-top px-2.5 py-1.5 type-body text-text-primary"
      >
        {PERIODS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
