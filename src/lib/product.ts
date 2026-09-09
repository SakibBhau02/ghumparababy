import { db } from "@/lib/db";
import {
  DEFAULT_PRODUCT_CONFIG,
  sanitizeProductConfig,
  type ProductConfig,
} from "@/lib/product-shared";

export const PRODUCT_SETTING_KEY = "product_config";

/** Read product/package prices from DB (falls back to current live prices). */
export async function getProductConfig(): Promise<ProductConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: PRODUCT_SETTING_KEY },
    });
    if (!row) return DEFAULT_PRODUCT_CONFIG;
    return sanitizeProductConfig(JSON.parse(row.value)) ?? DEFAULT_PRODUCT_CONFIG;
  } catch {
    return DEFAULT_PRODUCT_CONFIG;
  }
}

/** Persist product/package prices (admin only). */
export async function saveProductConfig(config: ProductConfig): Promise<void> {
  const sane =
    sanitizeProductConfig(config) ??
    (() => {
      throw new Error("invalid product config");
    })();
  await db.setting.upsert({
    where: { key: PRODUCT_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: PRODUCT_SETTING_KEY, value: JSON.stringify(sane) },
  });
}
