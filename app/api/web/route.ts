import { NextResponse } from "next/server";

import { web, EXAMPLE_SQL } from "@/mock/data";
import { instrument } from "@/lib/sources/meta";

// DEMO: serves fabricated web-traffic data (no PostHog). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const metric = p.get("metric") ?? "traffic";
  const startParam = p.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";

  const { rows, meta } = await instrument("mock", async () => {
    let r = web(metric);
    // Only the time series (traffic) is windowed by start; referrers/survey are totals.
    if (metric === "traffic") r = r.filter((row) => String(row.period) >= start);
    return {
      rows: r,
      query: EXAMPLE_SQL[metric],
      note: "Demo data — wire a real source in this route (see onboard).",
    };
  });
  return NextResponse.json({ rows, meta }, { headers: { "Cache-Control": "no-store" } });
}
