import { NextResponse } from "next/server";

import { buzz, mentions } from "@/mock/data";

// DEMO: serves fabricated social data (no Octolens). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const metric = p.get("metric") ?? "buzz";
  const startParam = p.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";

  if (metric === "mentions") {
    return NextResponse.json({ rows: mentions().filter((m) => String(m.timestamp).slice(0, 10) >= start) });
  }
  return NextResponse.json({ rows: buzz().filter((r) => r.period >= start) });
}
