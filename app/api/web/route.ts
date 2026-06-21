import { NextResponse } from "next/server";

import { web } from "@/mock/data";

// DEMO: serves fabricated web-traffic data (no PostHog). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const metric = p.get("metric") ?? "traffic";
  const startParam = p.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";

  let rows = web(metric);
  // Only the time series (traffic) is windowed by start; referrers/survey are totals.
  if (metric === "traffic") rows = rows.filter((r) => String(r.period) >= start);
  return NextResponse.json({ rows });
}
