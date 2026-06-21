import { NextResponse } from "next/server";

import { buzz, mentions, EXAMPLE_SQL } from "@/mock/data";
import { instrument } from "@/lib/sources/meta";

// DEMO: serves fabricated social data (no Octolens). See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const metric = p.get("metric") ?? "buzz";
  const startParam = p.get("start") ?? "";
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : "2020-01-01";

  const { rows, meta } = await instrument("mock", async () =>
    metric === "mentions"
      ? {
          rows: mentions().filter((m) => String(m.timestamp).slice(0, 10) >= start),
          note: "Demo data — wire a real source in this route (see onboard).",
        }
      : {
          rows: buzz().filter((r) => r.period >= start),
          query: EXAMPLE_SQL.buzz,
          note: "Demo data — wire a real source in this route (see onboard).",
        },
  );
  return NextResponse.json({ rows, meta }, { headers: { "Cache-Control": "no-store" } });
}
