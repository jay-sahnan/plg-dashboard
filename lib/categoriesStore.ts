// Server-only: reads/writes AI-assigned timeline categories to categories.json,
// keyed by eventKey() (lib/eventKey.ts). Mirrors lib/goalsStore.ts.
// File writing only works on a local/self-hosted run (not a read-only serverless
// host) — swap this for a DB/KV behind the same two functions when deploying.
import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "categories.json");

export type CategoryMap = Record<string, string>; // eventKey → category

export async function readCategories(): Promise<CategoryMap> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: CategoryMap = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v) out[k] = v;
    }
    return out;
  } catch {
    // No file yet / unreadable → nothing categorized.
    return {};
  }
}

// Serializes read-modify-write so two concurrent saves can't clobber each other
// (a single chained promise acts as an in-process lock). Same pattern as goals.
let writeChain: Promise<unknown> = Promise.resolve();

export function writeCategories(updates: CategoryMap): Promise<void> {
  const run = writeChain.then(async () => {
    const next: CategoryMap = { ...(await readCategories()) };
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === "string" && v) next[k] = v;
    }
    await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  });
  writeChain = run.catch(() => {}); // keep the chain alive even if this run fails
  return run;
}
