/**
 * Pure (client-safe) ShopBase BD fulfillment config — NO server imports here.
 * Server-side read/write + API calls live in src/lib/shopbase.ts.
 *
 * Setup (admin panel, one time): paste the partner token (test token first,
 * live token later), fill per-color SKUs, press "টেস্ট" — the server places
 * a clearly-marked TEST order to verify connectivity. From then on each
 * order gets a one-click "ShopBase-এ পাঠান" button.
 */

export type ShopbaseConfig = {
  enabled: boolean;
  token: string;
  /** Per-color product SKU on ShopBase (blue/red/brown/pink). */
  skus: Record<string, string>;
};

/** SKUs supplied by the seller (ShopBase BD product IDs). */
export const DEFAULT_SKUS: Record<string, string> = {
  blue: "32920",
  red: "32916",
  brown: "32918",
  pink: "32917",
};

export const DEFAULT_SHOPBASE_CONFIG: ShopbaseConfig = {
  enabled: false,
  token: "",
  skus: { ...DEFAULT_SKUS },
};

const MAX_TOKEN = 128;
const MAX_SKU = 16;

/** Sanitize anything coming from DB/admin into a valid ShopbaseConfig. */
export function sanitizeShopbaseConfig(input: unknown): ShopbaseConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const token =
    typeof rec.token === "string" ? rec.token.trim().slice(0, MAX_TOKEN) : "";
  const skus: Record<string, string> = { ...DEFAULT_SKUS };
  if (rec.skus && typeof rec.skus === "object") {
    for (const k of Object.keys(DEFAULT_SKUS)) {
      const v = (rec.skus as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) {
        skus[k] = v.trim().slice(0, MAX_SKU);
      }
    }
  }
  return { enabled: rec.enabled === true, token, skus };
}

/** Ready to actually call the API (enabled + token present). */
export function isShopbaseReady(config: ShopbaseConfig): boolean {
  return config.enabled && config.token.length > 0;
}
