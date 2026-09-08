import { db } from "@/lib/db";
import {
  DEFAULT_DELIVERY_CONFIG,
  type DeliveryConfig,
} from "@/lib/delivery-shared";

export {
  zoneCharge,
  isAllFree,
  deliveryBadgeText,
  DEFAULT_DELIVERY_CONFIG,
} from "@/lib/delivery-shared";
export type { DeliveryZone, DeliveryConfig } from "@/lib/delivery-shared";

export const DELIVERY_SETTING_KEY = "delivery_config";

/** Read delivery config from DB (falls back to defaults on any problem). */
export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: DELIVERY_SETTING_KEY },
    });
    if (!row) return DEFAULT_DELIVERY_CONFIG;
    const parsed = JSON.parse(row.value) as DeliveryConfig;
    if (!parsed || !Array.isArray(parsed.zones) || parsed.zones.length === 0) {
      return DEFAULT_DELIVERY_CONFIG;
    }
    // Sanitize: keep known shape only
    const zones = parsed.zones
      .filter((z) => z && typeof z.id === "string" && typeof z.label === "string")
      .map((z) => ({ id: z.id, label: z.label, charge: Number(z.charge) || 0 }));
    return zones.length === 0 ? DEFAULT_DELIVERY_CONFIG : { zones };
  } catch {
    return DEFAULT_DELIVERY_CONFIG;
  }
}

/** Persist delivery config. */
export async function saveDeliveryConfig(config: DeliveryConfig): Promise<void> {
  const value = JSON.stringify(config);
  await db.setting.upsert({
    where: { key: DELIVERY_SETTING_KEY },
    update: { value },
    create: { key: DELIVERY_SETTING_KEY, value },
  });
}
