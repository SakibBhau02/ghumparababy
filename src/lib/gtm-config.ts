import { db } from "@/lib/db";
import {
  DEFAULT_GTM_CONFIG,
  sanitizeGtmConfig,
  type GtmConfig,
} from "@/lib/gtm-shared";

/**
 * GTM কনফিগ সার্ভার-সাইড read/write।
 * সোর্স অগ্রাধিকার: DB (Setting.gtm_config) → .env NEXT_PUBLIC_GTM_ID → default (বন্ধ)
 * Admin panel থেকে সেভ করলে DB-ই active সোর্স।
 */

export const GTM_SETTING_KEY = "gtm_config";

/** DB থেকে বর্তমান GTM config (সমস্যা হলে নিরাপদ ডিফল্ট)। */
export async function getGtmConfig(): Promise<GtmConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: GTM_SETTING_KEY },
    });
    if (row) {
      const parsed = sanitizeGtmConfig(JSON.parse(row.value));
      if (parsed.containerId) return parsed;
    }
  } catch {
    // DB সমস্যা হলে env fallback-এ যাবে
  }

  const envId = (process.env.NEXT_PUBLIC_GTM_ID ?? "").trim();
  if (/^GTM-[A-Z0-9]+$/i.test(envId)) {
    return {
      ...DEFAULT_GTM_CONFIG,
      containerId: envId.toUpperCase(),
      enabled: true,
    };
  }
  return DEFAULT_GTM_CONFIG;
}

/** GTM config DB-তে সংরক্ষণ (admin panel থেকে কল হয়)। */
export async function saveGtmConfig(config: GtmConfig): Promise<void> {
  const value = JSON.stringify(config);
  await db.setting.upsert({
    where: { key: GTM_SETTING_KEY },
    update: { value },
    create: { key: GTM_SETTING_KEY, value },
  });
}
