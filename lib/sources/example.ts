// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE DATA SOURCE — copy this file to lib/sources/<your-source>.ts and adapt.
//
// A "source" is a small module that owns ONE real data source: a client/connection
// plus one query function per metric. An API route imports it and returns its rows.
// The dashboard does NOT store your metrics — it READS them from wherever your data
// already lives, at request time. This file shows the simplest possible source: a
// local SQLite file (zero credentials, nothing to host), which is a good stand-in
// when you don't have a warehouse. A commented Postgres variant is at the bottom.
//
// The golden rule: a query must return rows in the EXACT shape the chart's API route
// already emits — same field names, same casing (see the contract table in
// .claude/commands/onboard.md). Get that right and the chart needs zero changes.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from "node:fs";
import path from "node:path";

// The signups contract: /api/metrics?section=signups → { PERIOD, ICP_SCORE, SIGNUPS }.
// PERIOD = first day of the bucket as "YYYY-MM-DD" (monthly = "YYYY-MM-01").
// ICP_SCORE ∈ "A" | "B" | "C" | "Unscored"; map NULL/unknown fit → "Unscored".
export type SignupsRow = { PERIOD: string; ICP_SCORE: string; SIGNUPS: number };

// Where your local SQLite app DB lives. Set SQLITE_DB_PATH in .env.local; otherwise
// it falls back to data/app.db under the project root.
const DB_PATH = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), "data", "app.db");

/** True if the SQLite file exists — let the route fall back to mock data if not. */
export function dbAvailable(): boolean {
  return existsSync(DB_PATH);
}

/**
 * Roll a raw `users` table up to monthly signup counts by ICP tier.
 * Adjust the table/column names to match YOUR schema (Phase 2: discover the schema
 * and pin down what "signup" means before writing this).
 *
 * `node:sqlite` is built into Node (v22.5+) — no dependency to install. It's marked
 * experimental, so it prints one warning on first use; that's expected.
 */
export async function signupsByPeriod(start: string): Promise<SignupsRow[]> {
  // Imported lazily so merely importing this module never opens a DB or trips the
  // experimental warning until a query actually runs.
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `SELECT strftime('%Y-%m-01', created_at)        AS PERIOD,
                COALESCE(NULLIF(icp_score, ''), 'Unscored') AS ICP_SCORE,
                COUNT(*)                                 AS SIGNUPS
           FROM users
          WHERE created_at >= ?
          GROUP BY PERIOD, ICP_SCORE
          ORDER BY PERIOD`,
      )
      .all(start) as unknown as Array<{ PERIOD: string; ICP_SCORE: string; SIGNUPS: number }>;

    // Normalise types defensively (counts come back as numbers; cast to be safe).
    return rows.map((r) => ({ PERIOD: r.PERIOD, ICP_SCORE: r.ICP_SCORE, SIGNUPS: Number(r.SIGNUPS) }));
  } finally {
    db.close();
  }
}

// Wire it into app/api/metrics/route.ts (signups branch) like this:
//
//   import { dbAvailable, signupsByPeriod } from "@/lib/sources/example";
//   ...
//   if (section === "signups" && dbAvailable()) {
//     const rows = await signupsByPeriod(start);
//     return NextResponse.json({ rows, section }, { headers: { "Cache-Control": "no-store" } });
//   }
//   // else fall through to the existing mock(section) — keeps the app working until proven.

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES / SUPABASE VARIANT (the most common "I have an app DB" case)
//
//   // npm i pg @types/pg   — then DATABASE_URL=postgres://… in .env.local
//   import { Pool } from "pg";
//   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
//
//   export async function signupsByPeriod(start: string): Promise<SignupsRow[]> {
//     const { rows } = await pool.query<SignupsRow>(
//       `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM-01') AS "PERIOD",
//               COALESCE(icp_score, 'Unscored')                        AS "ICP_SCORE",
//               COUNT(*)::int                                          AS "SIGNUPS"
//          FROM users
//         WHERE created_at >= $1
//         GROUP BY 1, 2
//         ORDER BY 1`,
//       [start],
//     );
//     return rows;
//   }
//
// Note: Postgres folds unquoted identifiers to lowercase, so the SELECT aliases are
// double-quoted to preserve the exact PERIOD/ICP_SCORE/SIGNUPS casing the chart reads.
// ─────────────────────────────────────────────────────────────────────────────
