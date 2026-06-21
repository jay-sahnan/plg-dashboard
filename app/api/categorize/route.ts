import { NextResponse } from "next/server";

// DEMO: no AI categorisation (no Anthropic call). The timeline falls back to its
// fast local heuristic categories, which is plenty for the demo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ cats: {} });
}
