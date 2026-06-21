import { NextResponse } from "next/server";

// DEMO: the changelog feed is served entirely from the fabricated data/changelog.json
// (includes shipped wins + incidents). The live source pull is disabled.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: [] });
}
