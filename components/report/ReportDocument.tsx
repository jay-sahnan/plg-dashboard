"use client";

import { forwardRef } from "react";

import { ICP_TIERS } from "@/components/ChartControls";
import { useFilters } from "@/components/DashboardFilters";
import { KpiRow } from "@/components/KpiRow";
import { SignupsChart } from "@/components/SignupsChart";
import { ActivationChart } from "@/components/ActivationChart";
import { ConversionChart } from "@/components/ConversionChart";
import { ChurnChart } from "@/components/ChurnChart";
import { WebTrafficChart } from "@/components/WebTrafficChart";
import { ReferrersChart } from "@/components/ReferrersChart";
import { OnboardingSurveyChart } from "@/components/OnboardingSurveyChart";
import { BuzzChart } from "@/components/BuzzChart";

/**
 * Print-styled report document. Reuses the live chart + KPI components (which read
 * the active filters from context), so the report always matches the dashboard's
 * current Period / ICP tier / grain. Interactive controls are hidden via the
 * `.report-doc` CSS rule in globals.css.
 */
export const ReportDocument = forwardRef<HTMLDivElement>(function ReportDocument(_props, ref) {
  const { periodLabel, icp, grain, excludeCurrent } = useFilters();
  const tierLabel = icp.length === ICP_TIERS.length ? "All tiers" : icp.length ? icp.join(", ") : "None";
  const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div ref={ref} className="report-doc" style={{ width: 680, background: "var(--color-bg-bedrock)" }}>
      <header className="rounded-lg border border-border-solid bg-bg-top px-6 py-5">
        <p className="type-caption font-mono uppercase tracking-wide text-text-tertiary">Acme · Growth</p>
        <h1 className="type-jumbo mt-1 text-text-primary">PLG Growth Report</h1>
        <p className="type-body mt-2 text-text-secondary">
          {periodLabel} · {tierLabel} · grouped by {grain}
          {excludeCurrent ? " · excludes current" : ""} · generated {generated}
        </p>
      </header>

      <div className="mt-5">
        <KpiRow />
      </div>

      <div className="flex flex-col gap-5">
        <SignupsChart />
        <ActivationChart />
        <ConversionChart />
        <ChurnChart />
        <WebTrafficChart />
        <div className="grid grid-cols-2 gap-5">
          <ReferrersChart />
          <OnboardingSurveyChart />
        </div>
        <BuzzChart />
      </div>

      <footer className="mt-6 pb-1 text-center type-caption text-text-tertiary">
        PLG Growth Report · generated {generated}
      </footer>
    </div>
  );
});
