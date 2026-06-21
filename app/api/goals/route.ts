import { NextResponse } from "next/server";

import { readGoals } from "@/lib/goalsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ goals: await readGoals() }, { headers: { "Cache-Control": "no-store" } });
}
