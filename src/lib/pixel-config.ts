import { db } from "@/lib/db";
import {
  DEFAULT_PIXEL_CONFIG,
  sanitizePixelConfig,
  type PixelConfig,
} from "@/lib/pixel-shared";

/**
 * Meta Pixel কনফিগ সার্ভার-সাইড read/write।
 * সোর্স অগ্রাধিকার: DB (Setting.pixel_config) → .env NEXT_PUBLIC_FACEBOOK_PIXEL_ID → default (বন্ধ)
 * Admin panel থেকে সেভ করলে DB-ই active সোর্স — .env হাতে দেওয়া লাগে না।
 */

export const PIXEL_SETTING_KEY = "pixel_config";

/** DB থেকে বর্তমান pixel config (সমস্যা হলে নিরাপদ ডিফল্ট)। */
export async function getPixelConfig(): Promise<PixelConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: PIXEL_SETTING_KEY },
    });
    if (row) {
      const parsed = sanitizePixelConfig(JSON.parse(row.value));
      if (parsed.pixelId) return parsed;
    }
  } catch {
    // DB সমস্যা হলে env fallback-এ যাবে
  }

  // পুরনো .env পদ্ধতির সাথে সামঞ্জস্য: env-এ ID থাকলে সেটাই ব্যবহার হবে
  const envId = (process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ?? "").trim();
  if (/^\d{15,16}$/.test(envId)) {
    return {
      ...DEFAULT_PIXEL_CONFIG,
      pixelId: envId,
      enabled: true,
    };
  }
  return DEFAULT_PIXEL_CONFIG;
}

/** Pixel config DB-তে সংরক্ষণ (admin panel থেকে কল হয়)। */
export async function savePixelConfig(config: PixelConfig): Promise<void> {
  const value = JSON.stringify(config);
  await db.setting.upsert({
    where: { key: PIXEL_SETTING_KEY },
    update: { value },
    create: { key: PIXEL_SETTING_KEY, value },
  });
}
