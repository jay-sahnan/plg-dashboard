import { NextResponse } from "next/server";

import { insights } from "@/mock/data";
import { readGoals } from "@/lib/goalsStore";

// DEMO: deterministic data-driven analysis (no Anthropic call). The figures are
// computed from the series for the requested window + ICP tiers + goals. See mock/data.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { start?: string; end?: string; prompt?: string; icp?: string[]; excludeCurrent?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const start = body.start ?? "2025-04";
  const end = body.end ?? "2026-06";
  const goals = await readGoals();
  // Tiny pause so the slide-over's loading state is visible during a demo.
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json(
    insights({ start, end, prompt: body.prompt, icp: body.icp, excludeCurrent: body.excludeCurrent, goals }),
  );
}
