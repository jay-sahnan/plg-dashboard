import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone demo: pin the Turbopack root to THIS folder so Next 16 doesn't
  // walk up and infer a workspace root from a stray lockfile in ~/.
  turbopack: {
    root: __dirname,
  },
  // Don't bundle Node's built-in SQLite driver — it's only used server-side by a
  // data source (see lib/sources/example.ts). Harmless if you never use SQLite.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
