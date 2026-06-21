import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

// Publishes a self-contained HTML report to here.now and returns the live URL.
// Anonymous by default (24h); permanent when HERE_NOW_API_KEY is set.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLISH_URL = "https://here.now/api/v1/publish";

export async function POST(request: Request) {
  let body: { html?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const html = body.html;
  if (!html || typeof html !== "string") {
    return NextResponse.json({ error: "Missing report HTML." }, { status: 400 });
  }
  const title = body.title || "PLG Growth Report";

  const buf = Buffer.from(html, "utf-8");
  const hash = createHash("sha256").update(buf).digest("hex");
  const key = process.env.HERE_NOW_API_KEY;
  const auth: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};

  try {
    // 1. Create the site + get presigned upload target(s).
    const createRes = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        files: [{ path: "index.html", size: buf.length, contentType: "text/html; charset=utf-8", hash }],
        viewer: { title, description: "PLG growth report" },
      }),
    });
    if (!createRes.ok) {
      return NextResponse.json({ error: `Publish failed (${createRes.status}).` }, { status: 502 });
    }
    const pub = await createRes.json();

    // 2. Upload the HTML bytes to the presigned URL. Both upload + finalize are
    //    required — if the response shape is unexpected, fail loudly rather than
    //    return a "success" link to an empty, never-finalized site.
    const up = pub.upload?.uploads?.[0];
    if (!up?.url || !pub.upload?.finalizeUrl || !pub.upload?.versionId) {
      return NextResponse.json({ error: "Unexpected here.now response shape." }, { status: 502 });
    }
    const uploadRes = await fetch(up.url, {
      method: up.method || "PUT",
      headers: up.headers || { "Content-Type": "text/html; charset=utf-8" },
      body: buf,
    });
    if (!uploadRes.ok) {
      return NextResponse.json({ error: `Upload failed (${uploadRes.status}).` }, { status: 502 });
    }

    // 3. Finalize the version to make the site live.
    const finRes = await fetch(pub.upload.finalizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ versionId: pub.upload.versionId }),
    });
    if (!finRes.ok) {
      return NextResponse.json({ error: `Finalize failed (${finRes.status}).` }, { status: 502 });
    }

    return NextResponse.json({
      url: pub.siteUrl,
      permanent: !!key,
      claimUrl: pub.claimUrl ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach here.now: ${(e as Error).message}` }, { status: 502 });
  }
}
