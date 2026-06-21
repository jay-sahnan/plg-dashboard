import { NextResponse } from "next/server";

import { metrics } from "@/mock/data";

// DEMO: serves fabricated funnel data (no Snowflake). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN = new Set(["signups", "engagement", "conversion", "churn"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const section = params.get("section") ?? "";
  if (!KNOWN.has(section)) {
    return NextResponse.json({ rows: [], pending: true, section });
  }

  const startParam = params.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";

  const rows = metrics(section).filter((r) => String(r.PERIOD) >= start);
  return NextResponse.json({ rows, section }, { headers: { "Cache-Control": "no-store" } });
}
