import { NextResponse } from "next/server";

import { readCategories, writeCategories } from "@/lib/categoriesStore";

// Categorises timeline events into a fixed taxonomy and PERSISTS the result by
// event key (categories.json), so a refresh/reload keeps categories and only
// brand-new events ever hit the model.
//   GET  → the full persisted { key → category } map (timeline reads on mount)
//   POST → classify the events not yet stored, persist them, return their cats
// Real AI runs only when ANTHROPIC_API_KEY is set; otherwise it returns whatever
// is already stored and the timeline falls back to its local heuristic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["UI", "Launch", "Growth", "Billing", "Incident", "Social", "Platform", "Other"] as const;
const MODEL = "claude-haiku-4-5"; // cheap + fast — right tier for bulk classification

type Item = { key: string; title?: string; src?: string; hint?: string };

export async function GET() {
  return NextResponse.json({ cats: await readCategories() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let items: Item[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.items)) {
      items = body.items.filter((i: Item) => i && typeof i.key === "string");
    }
  } catch {
    /* empty / bad body → nothing to do */
  }

  const stored = await readCategories();
  const unknown = items.filter((i) => !stored[i.key]); // only new events reach the model
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (unknown.length && apiKey) {
    try {
      const fresh = await classify(unknown, apiKey);
      if (Object.keys(fresh).length) {
        await writeCategories(fresh); // persist → survives refresh, never re-billed
        Object.assign(stored, fresh);
      }
    } catch {
      /* leave unknowns to the client's heuristic fallback */
    }
  }

  // Return categories for exactly the requested keys we now know.
  const cats: Record<string, string> = {};
  for (const i of items) if (stored[i.key]) cats[i.key] = stored[i.key];
  return NextResponse.json({ cats }, { headers: { "Cache-Control": "no-store" } });
}

// One Claude (Haiku) call classifying a batch of events. Plain HTTPS — no SDK
// dependency. Structured outputs constrain the reply to the taxonomy.
async function classify(items: Item[], apiKey: string): Promise<Record<string, string>> {
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
        `You classify product timeline events. Assign each item exactly one category ` +
        `from: ${CATEGORIES.join(", ")}. Use "Other" only when nothing fits. ` +
        `Return every item, keyed by its "key".`,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["results"],
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "category"],
                  properties: {
                    key: { type: "string" },
                    category: { type: "string", enum: [...CATEGORIES] },
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
          content: JSON.stringify(
            items.map((i) => ({ key: i.key, title: i.title, source: i.src, hint: i.hint })),
          ),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  // Structured-output replies still arrive as a text block holding the JSON.
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  const parsed = JSON.parse(text) as { results?: Array<{ key?: string; category?: string }> };

  const out: Record<string, string> = {};
  for (const r of parsed.results ?? []) {
    if (typeof r.key === "string" && typeof r.category === "string" && (CATEGORIES as readonly string[]).includes(r.category)) {
      out[r.key] = r.category;
    }
  }
  return out;
}
