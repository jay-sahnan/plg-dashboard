import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared across requests in the same server process.
const g = globalThis as unknown as { __plgExit?: ReturnType<typeof setTimeout> };

// The browser fires this (via navigator.sendBeacon) when the tab is closing.
// We delay a few seconds so a refresh / second tab can cancel it via /api/heartbeat.
// Only self-terminates in production (the packaged desktop app runs `next start`);
// in dev we never kill the server out from under you.
export async function POST() {
  if (process.env.NODE_ENV === "production" && !g.__plgExit) {
    g.__plgExit = setTimeout(() => {
      console.log("[PLG] tab closed — shutting the server down");
      process.exit(0);
    }, 8000);
  }
  return NextResponse.json({ ok: true });
}
