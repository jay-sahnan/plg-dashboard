import { NextResponse } from "next/server";

import { metrics, EXAMPLE_SQL } from "@/mock/data";
import { instrument } from "@/lib/sources/meta";

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

  const { rows, meta } = await instrument("mock", async () => ({
    rows: metrics(section).filter((r) => String(r.PERIOD) >= start),
    query: EXAMPLE_SQL[section],
    note: "Demo data — wire a real source in this route (see onboard).",
  }));
  return NextResponse.json({ rows, meta, section }, { headers: { "Cache-Control": "no-store" } });
}
