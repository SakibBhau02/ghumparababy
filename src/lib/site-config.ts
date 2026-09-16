/**
 * Server-side read/write for the "site_images" Setting.
 * Keep this file server-only: importing it pulls in Prisma.
 */

import { db } from "@/lib/db";
import {
  DEFAULT_SITE_IMAGES,
  sanitizeSiteImagesConfig,
  type SiteImagesConfig,
} from "@/lib/site-images-config";

export const SITE_IMAGES_SETTING_KEY = "site_images";

/** Read site imagery from DB (falls back to current hardcoded values). */
export async function getSiteImages(): Promise<SiteImagesConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: SITE_IMAGES_SETTING_KEY },
    });
    if (!row) return DEFAULT_SITE_IMAGES;
    return sanitizeSiteImagesConfig(JSON.parse(row.value));
  } catch {
    return DEFAULT_SITE_IMAGES;
  }
}

/** Persist site imagery (admin only). */
export async function saveSiteImages(config: SiteImagesConfig): Promise<void> {
  const sane = sanitizeSiteImagesConfig(config);
  await db.setting.upsert({
    where: { key: SITE_IMAGES_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: SITE_IMAGES_SETTING_KEY, value: JSON.stringify(sane) },
  });
}