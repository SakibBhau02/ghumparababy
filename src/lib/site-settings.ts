import { db } from "@/lib/db";

/**
 * Tiny on/off site settings stored in the Setting table.
 * - location_enabled: order form-এ বিভাগ/জেলা/উপজেলা ব্লক দেখাবে কিনা (default: on)
 */

export const LOCATION_SETTING_KEY = "location_enabled";

/** True unless admin explicitly turned the location block off. */
export async function getLocationEnabled(): Promise<boolean> {
  try {
    const row = await db.setting.findUnique({
      where: { key: LOCATION_SETTING_KEY },
    });
    if (!row) return true;
    return row.value.trim().toLowerCase() !== "false";
  } catch {
    return true;
  }
}

/** Persist the location-block toggle (admin only). */
export async function setLocationEnabled(enabled: boolean): Promise<void> {
  await db.setting.upsert({
    where: { key: LOCATION_SETTING_KEY },
    update: { value: enabled ? "true" : "false" },
    create: { key: LOCATION_SETTING_KEY, value: enabled ? "true" : "false" },
  });
}
