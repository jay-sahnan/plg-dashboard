"use server";

import { revalidatePath } from "next/cache";

import { GOAL_KEYS } from "@/lib/goalsConfig";
import { writeGoals } from "@/lib/goalsStore";

export type SaveState = { ok: boolean; message: string } | null;

export async function saveGoals(_prev: SaveState, formData: FormData): Promise<SaveState> {
  try {
    const updates: Record<string, number> = {};
    for (const k of GOAL_KEYS) {
      const raw = formData.get(k);
      const s = typeof raw === "string" ? raw.trim() : "";
      updates[k] = s === "" ? 0 : Number(s); // 0 / empty clears the goal
    }
    await writeGoals(updates);
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: "Goals saved to goals.json." };
  } catch (e) {
    return { ok: false, message: `Could not save — file writing only works on a local run. (${(e as Error).message})` };
  }
}
