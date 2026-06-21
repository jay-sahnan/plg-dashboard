"use client";

import { useEffect, useState } from "react";

import type { SourceMeta } from "@/lib/sources/meta";

/**
 * Fetches one of the dashboard's `/api/*` JSON endpoints (which return
 * `{ rows, meta }` on success or `{ error }` on failure) with a StrictMode-safe
 * `alive` guard.
 *
 * `url` already encodes the query; a changing URL drives the re-fetch. Pass
 * `refetchKey` (e.g. the global refresh `version`) to force a re-fetch when the URL
 * is unchanged. While the current request differs from the last resolved one, the
 * hook reports nulls so callers render their loading state.
 */
export function useMetrics<Row>(
  url: string,
  refetchKey?: unknown,
): { rows: Row[] | null; error: string | null; meta: SourceMeta | null } {
  const key = `${url}::${String(refetchKey)}`;
  const [result, setResult] = useState<{
    key: string;
    rows: Row[] | null;
    error: string | null;
    meta: SourceMeta | null;
  }>({ key: "", rows: null, error: null, meta: null });

  useEffect(() => {
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setResult({ key, rows: null, error: String(d.error), meta: d.meta ?? null });
        else setResult({ key, rows: (d.rows ?? []) as Row[], error: null, meta: (d.meta ?? null) as SourceMeta | null });
      })
      .catch((e) => {
        if (alive) setResult({ key, rows: null, error: (e as Error).message, meta: null });
      });
    return () => {
      alive = false;
    };
  }, [url, refetchKey, key]);

  if (result.key !== key) return { rows: null, error: null, meta: null };
  return { rows: result.rows, error: result.error, meta: result.meta };
}
