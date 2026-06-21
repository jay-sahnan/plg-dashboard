"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ICP_TIERS, type Grain, PERIODS, startForPeriod } from "@/components/ChartControls";

type Range = { start: string; end: string } | null;

type FiltersContextValue = {
  /** Period start date (YYYY-MM-DD) derived from the selected period label. */
  start: string;
  periodLabel: string;
  grain: Grain;
  excludeCurrent: boolean;
  icp: string[];
  icpBreakdown: boolean;
  /** Bumped by "Refresh data" to bust the metric-chart fetch cache. */
  version: number;
  /** Per-period goals (from goals.json) keyed by metric, e.g. { signups: 8000 }. */
  goals: Record<string, number>;
  /** Re-fetch goals from goals.json (called after saving in the settings modal). */
  reloadGoals: () => Promise<void>;
  selectedMonth: string | null;
  selectedRange: Range;
  // Cross-chart timeline selection (called from the charts' drag-select).
  onSelectMonth: (ym: string) => void;
  onSelectRange: (start: string, end: string) => void;
  /** Clears the drag-selected range only (the header chip's ✕). */
  clearRange: () => void;
  /** Clears both the selected month and range (the timeline's "clear"). */
  clearSelection: () => void;
  // Header control setters.
  setPeriodLabel: (label: string) => void;
  setGrain: (g: Grain) => void;
  setExcludeCurrent: (v: boolean) => void;
  setIcp: (v: string[]) => void;
  setIcpBreakdown: (v: boolean) => void;
  bumpVersion: () => void;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

/**
 * Owns all dashboard filter + cross-chart selection state. Charts read what
 * they need via {@link useFilters} instead of receiving the same ~10 props
 * drilled through every component.
 */
export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [periodLabel, setPeriodLabel] = useState("All time");
  const [grain, setGrain] = useState<Grain>("month");
  const [excludeCurrent, setExcludeCurrent] = useState(false);
  const [icp, setIcp] = useState<string[]>([...ICP_TIERS]);
  const [icpBreakdown, setIcpBreakdown] = useState(false);
  const [version, setVersion] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<Range>(null);
  const [goals, setGoals] = useState<Record<string, number>>({});

  const reloadGoals = useCallback(async () => {
    try {
      const r = await fetch("/api/goals", { cache: "no-store" });
      const d = await r.json();
      setGoals(d.goals ?? {});
    } catch {
      /* keep current goals */
    }
  }, []);

  // Load saved goals on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, not a sync cascade
    reloadGoals();
  }, [reloadGoals]);

  const start = startForPeriod(PERIODS.find((p) => p.label === periodLabel) ?? PERIODS[1]!);

  const onSelectMonth = useCallback((ym: string) => setSelectedMonth(ym), []);
  // Highlighting a range supersedes a single-month click.
  const onSelectRange = useCallback((s: string, e: string) => {
    setSelectedRange({ start: s, end: e });
    setSelectedMonth(null);
  }, []);
  const clearRange = useCallback(() => setSelectedRange(null), []);
  const clearSelection = useCallback(() => {
    setSelectedMonth(null);
    setSelectedRange(null);
  }, []);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<FiltersContextValue>(
    () => ({
      start,
      periodLabel,
      grain,
      excludeCurrent,
      icp,
      icpBreakdown,
      version,
      goals,
      reloadGoals,
      selectedMonth,
      selectedRange,
      onSelectMonth,
      onSelectRange,
      clearRange,
      clearSelection,
      setPeriodLabel,
      setGrain,
      setExcludeCurrent,
      setIcp,
      setIcpBreakdown,
      bumpVersion,
    }),
    [
      start,
      periodLabel,
      grain,
      excludeCurrent,
      icp,
      icpBreakdown,
      version,
      goals,
      reloadGoals,
      selectedMonth,
      selectedRange,
      onSelectMonth,
      onSelectRange,
      clearRange,
      clearSelection,
      bumpVersion,
    ],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within a DashboardFiltersProvider");
  return ctx;
}
