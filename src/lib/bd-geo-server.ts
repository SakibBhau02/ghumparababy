/**
 * Server-only loader for the BD geo dataset.
 * Never import this file from client components — use fetch("/data/bd-geo.json").
 */
import { promises as fs } from "fs";
import path from "path";
import type { BdDivision } from "@/lib/bd-geo";

let cache: BdDivision[] | null = null;

export async function loadBdGeo(): Promise<BdDivision[]> {
  if (cache) return cache;
  const raw = await fs.readFile(
    path.join(process.cwd(), "public", "data", "bd-geo.json"),
    "utf8"
  );
  cache = JSON.parse(raw) as BdDivision[];
  return cache;
}
