import { NextResponse } from "next/server";

import { insights } from "@/mock/data";
import { readGoals } from "@/lib/goalsStore";

// AI Insights for the selected window. We always compute a deterministic,
// factually-correct analysis first (real figures from the series). With
// ANTHROPIC_API_KEY set, Claude synthesizes a sharper narrative *grounded on
// those figures* (never inventing numbers) and returns the SAME shape, so the
// panel needs no changes. With no key, we serve the deterministic analysis.
// Insights are on-demand and fresh per request — nothing is persisted.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8"; // narrative analysis → strongest default model

type Base = ReturnType<typeof insights>;

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

  // Real figures computed from the series for the window + ICP tiers + goals.
  const base = insights({ start, end, prompt: body.prompt, icp: body.icp, excludeCurrent: body.excludeCurrent, goals });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key → deterministic analysis (with the demo delay so the loader shows).
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json(base);
  }

  try {
    const enriched = await analyze(base, body.prompt, apiKey);
    return NextResponse.json({ ...enriched, range: base.range });
  } catch {
    return NextResponse.json(base); // any failure → fall back to deterministic
  }
}

// One Claude call. Grounded on the deterministic analysis; structured output
// constrains the reply to the panel's shape. Plain HTTPS — no SDK dependency.
async function analyze(base: Base, prompt: string | undefined, apiKey: string): Promise<Pick<Base, "summary" | "insights">> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system:
        "You are a senior product-led-growth analyst writing the Insights panel of a metrics dashboard. " +
        "You are given a deterministic, factually-correct analysis of a time window — real figures computed from the data — and an optional user steer. " +
        "Write a crisp executive summary (2-3 sentences) and 3 to 6 insight cards. " +
        "Ground every quantitative claim in the provided figures; never invent numbers or trends that are not in the input. " +
        "If a steer is given, focus the analysis on it. " +
        "Each card has a short title, a 1-2 sentence detail, a kind (trend | cause | risk | opportunity), and a confidence (high | medium | low).",
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "insights"],
            properties: {
              summary: { type: "string" },
              insights: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "detail", "kind", "confidence"],
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    kind: { type: "string", enum: ["trend", "cause", "risk", "opportunity"] },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            range: base.range,
            deterministic_analysis: { summary: base.summary, insights: base.insights },
            steer: prompt || null,
          }),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  const parsed = JSON.parse(text) as Partial<Pick<Base, "summary" | "insights">>;

  const KINDS = new Set(["trend", "cause", "risk", "opportunity"]);
  const CONF = new Set(["high", "medium", "low"]);
  const cards = Array.isArray(parsed.insights)
    ? parsed.insights
        .filter((i) => i && typeof i.title === "string" && typeof i.detail === "string" && KINDS.has(i.kind) && CONF.has(i.confidence))
        .slice(0, 6)
    : [];

  // Fall back to the deterministic pieces if the model returned nothing usable.
  return {
    summary: typeof parsed.summary === "string" && parsed.summary ? parsed.summary : base.summary,
    insights: cards.length ? cards : base.insights,
  };
}
