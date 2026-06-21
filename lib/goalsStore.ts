// Server-only: reads/writes per-period goals to goals.json in the project root.
// File writing only works on a local/self-hosted run (not a read-only serverless host).
import { promises as fs } from "fs";
import path from "path";

import { GOAL_KEYS, type Goals } from "@/lib/goalsConfig";

const FILE = path.join(process.cwd(), "goals.json");

export async function readGoals(): Promise<Goals> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Goals = {};
    for (const k of GOAL_KEYS) {
      const v = Number(obj[k]);
      if (Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    // No file yet / unreadable → no goals.
    return {};
  }
}

// Serializes read-modify-write so two concurrent saves can't read the same base
// and clobber each other (a single chained promise acts as an in-process lock).
let writeChain: Promise<unknown> = Promise.resolve();

export function writeGoals(updates: Goals): Promise<void> {
  const run = writeChain.then(async () => {
    const next: Goals = { ...(await readGoals()) };
    for (const k of GOAL_KEYS) {
      if (!(k in updates)) continue;
      const v = Number(updates[k]);
      if (Number.isFinite(v) && v > 0) next[k] = v;
      else delete next[k]; // empty / 0 clears the goal
    }
    await fs.writeFile(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  });
  writeChain = run.catch(() => {}); // keep the chain alive even if this run fails
  return run;
}
