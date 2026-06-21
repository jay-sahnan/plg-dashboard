"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { RefreshCw, Settings, Share2, Sparkles, X } from "lucide-react";

import { InsightsPanel } from "@/components/InsightsPanel";
import { KeepAlive } from "@/components/KeepAlive";
import { KpiRow } from "@/components/KpiRow";
import { SettingsModal } from "@/components/SettingsModal";
import { ExportModal } from "@/components/ExportModal";
import { DashboardFiltersProvider, useFilters } from "@/components/DashboardFilters";
import {
  IcpFilter,
  currentBucketStart,
  ExcludeCurrentToggle,
  GrainToggle,
  PeriodSelect,
} from "@/components/ChartControls";

/** Placeholder shown while a chart's code chunk is still downloading. */
function ChartCardSkeleton({ h = 360 }: { h?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-solid bg-bg-top">
      <div className="border-b border-border-faint px-5 py-4">
        <div className="h-4 w-44 animate-pulse rounded bg-bg-subtle" />
      </div>
      <div className="p-4" style={{ height: h }}>
        <div className="h-full w-full animate-pulse rounded-md bg-bg-subtle" />
      </div>
    </div>
  );
}

// Charts pull in Recharts and sit below the fold, so each is code-split into its
// own chunk (ssr:false — the data is fetched client-side anyway) to keep the
// initial dashboard bundle small.
const BuzzChart = dynamic(() => import("@/components/BuzzChart").then((m) => m.BuzzChart), { ssr: false, loading: () => <ChartCardSkeleton h={320} /> });
const WebTrafficChart = dynamic(() => import("@/components/WebTrafficChart").then((m) => m.WebTrafficChart), { ssr: false, loading: () => <ChartCardSkeleton h={320} /> });
const ReferrersChart = dynamic(() => import("@/components/ReferrersChart").then((m) => m.ReferrersChart), { ssr: false, loading: () => <ChartCardSkeleton h={320} /> });
const OnboardingSurveyChart = dynamic(() => import("@/components/OnboardingSurveyChart").then((m) => m.OnboardingSurveyChart), { ssr: false, loading: () => <ChartCardSkeleton h={320} /> });
const SignupsChart = dynamic(() => import("@/components/SignupsChart").then((m) => m.SignupsChart), { ssr: false, loading: () => <ChartCardSkeleton /> });
const ActivationChart = dynamic(() => import("@/components/ActivationChart").then((m) => m.ActivationChart), { ssr: false, loading: () => <ChartCardSkeleton /> });
const ConversionChart = dynamic(() => import("@/components/ConversionChart").then((m) => m.ConversionChart), { ssr: false, loading: () => <ChartCardSkeleton /> });
const ChurnChart = dynamic(() => import("@/components/ChurnChart").then((m) => m.ChurnChart), { ssr: false, loading: () => <ChartCardSkeleton /> });
const ChangelogTimeline = dynamic(() => import("@/components/ChangelogTimeline").then((m) => m.ChangelogTimeline), { ssr: false, loading: () => <ChartCardSkeleton h={560} /> });

const fmtYM = (ym: string) => {
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m] = ym.split("-");
  return `${mons[Number(m) - 1] ?? m} '${y?.slice(2)}`;
};

export function Dashboard() {
  return (
    <DashboardFiltersProvider>
      <DashboardBody />
    </DashboardFiltersProvider>
  );
}

function DashboardBody() {
  const {
    start,
    grain,
    icp,
    icpBreakdown,
    excludeCurrent,
    periodLabel,
    selectedMonth,
    selectedRange,
    setIcp,
    setIcpBreakdown,
    setGrain,
    setExcludeCurrent,
    setPeriodLabel,
    clearRange,
    clearSelection,
    bumpVersion,
  } = useFilters();

  const [spinning, setSpinning] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const router = useRouter();

  // The range fed to insights: an explicit drag-selection if present, else the
  // visible period (its start month → current month).
  const insightsRange = useMemo(() => {
    if (selectedRange) return selectedRange;
    const startYM = start.slice(0, 7);
    const endYM = currentBucketStart("month").slice(0, 7);
    return { start: startYM < endYM ? startYM : endYM, end: endYM };
  }, [selectedRange, start]);

  // Esc closes the Insights panel if open, otherwise clears an active chart
  // selection — but never while typing in a field. Dropdowns handle their own
  // Esc and stopPropagation, so closing one doesn't also clear the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (exportOpen) {
        setExportOpen(false);
        return;
      }
      if (insightsOpen) {
        setInsightsOpen(false);
        return;
      }
      if (selectedRange || selectedMonth) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen, insightsOpen, selectedRange, selectedMonth, clearSelection]);

  const refresh = useCallback(() => {
    setSpinning(true);
    // version (in context) busts every chart's fetch cache; router.refresh
    // re-runs any server components. Charts refetch without remounting, so
    // local UI state (chart type, timeline chip filters) is preserved.
    bumpVersion();
    router.refresh();
    setTimeout(() => setSpinning(false), 700);
  }, [router, bumpVersion]);

  return (
    <main className="mx-auto max-w-[1760px] px-5 py-8">
      <KeepAlive />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <p className="type-caption font-mono uppercase tracking-wide text-text-tertiary">
            Acme · Growth
          </p>
          <h1 className="type-jumbo mt-1 text-text-primary">PLG Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border-solid bg-bg-top px-3 py-2 type-body text-text-primary transition-colors hover:bg-bg-layered"
            title="Share or export a report (link / HTML / PDF)"
          >
            <Share2 size={14} />
            Share / Export
          </button>
          <button
            onClick={() => setInsightsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-2 type-body text-white transition-colors hover:opacity-90"
            title="Analyze the selected (or visible) period with Claude"
          >
            <Sparkles size={14} />
            Insights
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-md border border-border-solid bg-bg-top px-3 py-2 type-body text-text-primary transition-colors hover:bg-bg-layered"
          >
            <RefreshCw size={14} className={spinning ? "animate-spin" : undefined} />
            Refresh data
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Goals & settings"
            aria-label="Settings"
            className="flex items-center justify-center rounded-md border border-border-solid bg-bg-top p-2 text-text-primary transition-colors hover:bg-bg-layered"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Toolbar: account-tier filter · time controls */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border-faint bg-bg-top px-4 py-3">
        <IcpFilter value={icp} onChange={setIcp} breakdown={icpBreakdown} onBreakdownChange={setIcpBreakdown} />

        <span aria-hidden className="hidden h-6 w-px bg-border-faint sm:block" />

        <PeriodSelect value={periodLabel} onChange={setPeriodLabel} />
        <div className="flex items-center gap-2">
          <span className="type-caption text-text-tertiary">Group by</span>
          <GrainToggle value={grain} onChange={setGrain} />
        </div>
        <ExcludeCurrentToggle value={excludeCurrent} onChange={setExcludeCurrent} grain={grain} />

        {selectedRange ? (
          <span className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 type-caption text-text-primary">
            {fmtYM(selectedRange.start)} – {fmtYM(selectedRange.end)}
            <button onClick={clearRange} className="text-text-tertiary hover:text-text-primary" title="Clear range" aria-label="Clear selected range">
              <X size={12} />
            </button>
          </span>
        ) : null}
      </div>

      <KpiRow />

      {/* Charts on the left (traffic → signups → activation → conversion → churn), table on the right */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(440px,540px)] lg:items-start">
        <div className="flex flex-col gap-5">
          <BuzzChart />
          <WebTrafficChart />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ReferrersChart />
            <OnboardingSurveyChart />
          </div>
          <SignupsChart />
          <ActivationChart />
          <ConversionChart />
          <ChurnChart />
        </div>

        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
          <ChangelogTimeline
            monthFilter={selectedMonth}
            range={selectedRange}
            onClear={clearSelection}
          />
        </aside>
      </div>

      <InsightsPanel open={insightsOpen} onClose={() => setInsightsOpen(false)} range={insightsRange} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </main>
  );
}
