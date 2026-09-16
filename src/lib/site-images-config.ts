/**
 * Site imagery configuration (client-safe) — lives in Setting "site_images".
 * Admin uploads/edits these from /admin/images; every landing component
 * and layout reads them via getSiteImages() (server) with these defaults.
 */

import { siteImage } from "@/lib/site-images";

/** Every editable image slot on the site. */
export type SiteImageSlot =
  | "hero"
  | "solution"
  | "howToUse"
  | "ogImage"
  | "favicon";

export const SITE_IMAGE_SLOTS = [
  "hero",
  "solution",
  "howToUse",
  "ogImage",
  "favicon",
] as const;

export type SiteImagesConfig = Record<SiteImageSlot, string>;

/** Current hardcoded values — used until admin saves a change. */
export const DEFAULT_SITE_IMAGES: SiteImagesConfig = {
  hero: siteImage("/images/swaddle-blue.jpg"),
  solution: siteImage("/images/swaddle-brown.jpg"),
  howToUse: siteImage("/images/swaddle-pink.jpg"),
  ogImage: siteImage("/images/swaddle-blue.jpg"),
  favicon: siteImage("/images/swaddle-pink.jpg"),
};

/** Nice Bengali label per slot (admin UI). */
export const SITE_IMAGE_SLOT_LABELS: Record<SiteImageSlot, string> = {
  hero: "হিরো ব্যানার ছবি",
  solution: "সমাধান সেকশন ছবি",
  howToUse: "ব্যবহারের নিয়ম ছবি",
  ogImage: "OG / শেয়ার ছবি",
  favicon: "ব্রাউজার আইকন (favicon)",
};

/** Sanitize anything from DB/admin into a valid SiteImagesConfig. */
export function sanitizeSiteImagesConfig(input: unknown): SiteImagesConfig {
  const rec = (input ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SITE_IMAGES } as SiteImagesConfig;
  for (const slot of SITE_IMAGE_SLOTS) {
    const v = rec[slot];
    if (typeof v === "string" && /^https?:\/\/\S+$/.test(v.trim())) {
      out[slot] = v.trim();
    }
  }
  return out;
}