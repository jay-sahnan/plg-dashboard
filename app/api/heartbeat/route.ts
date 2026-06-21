import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __plgExit?: ReturnType<typeof setTimeout> };

// An open tab pings this every few seconds. It cancels any pending shutdown,
// so a page refresh or a second open tab keeps the server alive.
export async function GET() {
  if (g.__plgExit) {
    clearTimeout(g.__plgExit);
    g.__plgExit = undefined;
  }
  return NextResponse.json({ ok: true });
}
