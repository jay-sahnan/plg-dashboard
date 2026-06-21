// Shared provenance metadata returned by every data source (mock or real),
// surfaced on the back of each chart card. See docs/plans/2026-06-20-card-flip-provenance-design.md.

export type SourceMeta = {
  source: "snowflake" | "posthog" | "hex" | "sqlite" | "postgres" | "mock" | (string & {});
  ok: boolean;            // did the upstream pull succeed
  fetchedAt: string;      // ISO time the pull ran
  durationMs?: number;    // how long upstream took
  error?: string;         // message when ok=false
  query?: string;         // SQL (Snowflake/Hex/SQLite/Postgres)
  insight?: { id?: string; name?: string; url?: string }; // PostHog
  dashboardUrl?: string;  // Hex/Metabase/Looker link
  rowCount?: number;
  note?: string;
};

// Static descriptor a source supplies; instrument() merges it with timing/status.
type RunResult<T> = { rows: T[] } & Omit<Partial<SourceMeta>, "ok" | "fetchedAt" | "durationMs" | "rowCount">;

/**
 * Wrap a data-source call so every route returns uniform { rows, meta }. Times the
 * call, stamps fetchedAt, and turns a thrown upstream error into ok:false (never
 * breaks the chart — it just renders the error on the back of the card).
 */
export async function instrument<T>(
  source: SourceMeta["source"],
  run: () => Promise<RunResult<T>>,
): Promise<{ rows: T[]; meta: SourceMeta }> {
  const fetchedAt = new Date().toISOString();
  const t0 = performance.now();
  try {
    const { rows, ...descriptor } = await run();
    return {
      rows,
      meta: {
        source,
        ok: true,
        fetchedAt,
        durationMs: Math.round(performance.now() - t0),
        rowCount: rows.length,
        ...descriptor,
      },
    };
  } catch (e) {
    return {
      rows: [],
      meta: {
        source,
        ok: false,
        fetchedAt,
        durationMs: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
