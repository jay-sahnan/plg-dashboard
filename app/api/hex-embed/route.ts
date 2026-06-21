import { NextResponse } from "next/server";

// snowflake-sdk-free: pure Hex embedding. Must run on Node (not edge) and never
// be cached — Hex signed embed URLs are single-use.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = process.env.HEX_BASE_URL ?? "https://app.hex.tech/api/v1";

/**
 * Maps a logical chart name to a Hex project id. Today both the signups and
 * activation charts live inside the published "PLG Dashboard" project, so they
 * resolve to the same embed (the embed shows the whole published app). If those
 * charts are split into their own published projects later, add their ids here.
 */
function projectIdFor(chart: string | null): string | undefined {
  const plg = process.env.HEX_PLG_PROJECT_ID;
  switch (chart) {
    case "activation":
      return process.env.HEX_ACTIVATION_PROJECT_ID ?? plg;
    case "signups":
    default:
      return plg;
  }
}

export async function GET(request: Request) {
  const token = process.env.HEX_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HEX_API_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const chart = new URL(request.url).searchParams.get("chart");
  const projectId = projectIdFor(chart);
  if (!projectId) {
    return NextResponse.json(
      { error: "No Hex project id configured (set HEX_PLG_PROJECT_ID)." },
      { status: 500 },
    );
  }

  const res = await fetch(`${BASE_URL}/embedding/createPresignedUrl/${projectId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // displayOptions can be tuned later (e.g. hide chrome). Empty body = defaults.
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    // 403 here almost always means: the token lacks CREATE_EMBEDDED_LINKS, or
    // embedding is not enabled on the project. Surface it so the UI can explain.
    return NextResponse.json(
      { error: "hex_embed_unauthorized", status: res.status, detail },
      { status: res.status === 403 ? 403 : 502 },
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    return NextResponse.json(
      { error: "Hex did not return an embed url.", raw: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } });
}
