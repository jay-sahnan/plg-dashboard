// Stable identity for a timeline event — client- and server-safe (no fs), so the
// categorize route and the timeline component derive the SAME key for an event.
// Used to persist AI categories against events (see lib/categoriesStore.ts).

export type KeyableEvent = {
  id?: string;
  url?: string;
  date?: string;
  src?: string;
  title?: string;
};

// FNV-1a, base36 — same hash family as mock/data.ts. Deterministic, no deps.
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Prefer a source-provided id (Linear issue, etc.) or url; otherwise a content
 * hash of date|src|title. The content hash means editing an event's text yields
 * a new key (so it re-categorizes), while leaving it unchanged keeps the label
 * forever — persistence, not a cache.
 */
export function eventKey(e: KeyableEvent): string {
  if (e.id) return `id:${e.id}`;
  if (e.url) return `url:${e.url}`;
  return `h:${hash(`${e.date ?? ""}|${e.src ?? ""}|${e.title ?? ""}`)}`;
}
