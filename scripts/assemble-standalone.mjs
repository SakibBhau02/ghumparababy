/**
 * Post-build: copy public + static assets into the standalone output
 * (self-hosted/Docker). No-op when standalone output is disabled
 * (e.g. Vercel builds) or on platforms without `cp`.
 *
 * Replaces the old shell chain:
 *   cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
 */
import { existsSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.log(
    "assemble-standalone: no .next/standalone directory (standalone output off) — skipping."
  );
  process.exit(0);
}

cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), {
  recursive: true,
});
cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
});
console.log("assemble-standalone: assets copied.");
