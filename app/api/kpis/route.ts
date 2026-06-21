import { NextResponse } from "next/server";

import { kpis } from "@/mock/data";

// DEMO: top-level KPI summary (period totals + previous-period deltas). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ICP = ["A", "B", "C", "Unscored"];

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const startParam = p.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";
  // `icp` present (even empty) → use it verbatim; absent → default to all tiers.
  const icp = p.has("icp")
    ? (p.get("icp") || "").split(",").filter((c) => ICP.includes(c))
    : ICP;
  const excludeCurrent = p.get("excludeCurrent") === "1";

  return NextResponse.json(
    { rows: [kpis({ start, icp, excludeCurrent })] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
