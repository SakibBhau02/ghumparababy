import { db } from "@/lib/db";
import {
  DEFAULT_SKUS,
  DEFAULT_SHOPBASE_CONFIG,
  sanitizeShopbaseConfig,
  type ShopbaseConfig,
} from "@/lib/shopbase-shared";

export const SHOPBASE_SETTING_KEY = "shopbase_config";
export const SHOPBASE_BASE_URL =
  "https://shopbasebd.com/api/appapi/partner/order/placeOrder";

/** Read ShopBase config from DB (safe defaults on any problem). */
export async function getShopbaseConfig(): Promise<ShopbaseConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: SHOPBASE_SETTING_KEY },
    });
    if (!row) return DEFAULT_SHOPBASE_CONFIG;
    return sanitizeShopbaseConfig(JSON.parse(row.value)) ?? DEFAULT_SHOPBASE_CONFIG;
  } catch {
    return DEFAULT_SHOPBASE_CONFIG;
  }
}

/** Persist ShopBase config (admin only). */
export async function saveShopbaseConfig(config: ShopbaseConfig): Promise<void> {
  const sane =
    sanitizeShopbaseConfig(config) ??
    (() => {
      throw new Error("invalid shopbase config");
    })();
  await db.setting.upsert({
    where: { key: SHOPBASE_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: SHOPBASE_SETTING_KEY, value: JSON.stringify(sane) },
  });
}

export type SbOrderInput = {
  invoiceId: string;
  customerName: string;
  phone: string;
  district: string;
  shippingAddress: string;
  orderNote: string;
  /** One entry per distinct color: { sku, qty, price-per-piece, size }. */
  items: { sku: string; qty: number; price: number; size?: string }[];
};

export type SbResult =
  | { ok: true; sbrOrderId: string }
  | { ok: false; error: string };

/**
 * Aggregate an order's color list into per-color checkout items.
 * Unknown colors (legacy orders) are skipped — the caller checks the result
 * is non-empty before sending.
 */
export function buildItemsFromColors(
  config: ShopbaseConfig,
  colors: string[],
  perPiecePrice: number
): { sku: string; qty: number; price: number; size: string }[] {
  const counts = new Map<string, number>();
  for (const c of colors) counts.set(c, (counts.get(c) ?? 0) + 1);
  const items: { sku: string; qty: number; price: number; size: string }[] = [];
  for (const [color, qty] of counts) {
    const sku = config.skus[color] ?? DEFAULT_SKUS[color];
    if (!sku) continue;
    // Free-size product — ShopBase requires checkout_items[].size ("F" = Free).
    items.push({ sku, qty, price: perPiecePrice, size: "F" });
  }
  return items;
}

/**
 * Build checkout items from stored order lines (mixed orders).
 * Lines with their own shopbaseSku (new collection) go as-is;
 * legacy-product lines map their colorIds through the per-color config.
 * Unknown colors are skipped — the caller checks non-empty before sending.
 */
export function buildItemsFromLines(
  config: ShopbaseConfig,
  lines: { shopbaseSku?: string; qty: number; price: number; colorIds?: string[] }[]
): { sku: string; qty: number; price: number }[] {
  const bySku = new Map<string, { qty: number; price: number }>();
  const add = (sku: string, qty: number, price: number) => {
    const cur = bySku.get(sku);
    if (cur) cur.qty += qty;
    else bySku.set(sku, { qty, price });
  };
  for (const l of lines) {
    const qty = Math.round(l.qty) || 0;
    if (qty <= 0) continue;
    if (l.shopbaseSku && l.shopbaseSku.trim()) {
      add(l.shopbaseSku.trim(), qty, l.price);
      continue;
    }
    for (const color of l.colorIds ?? []) {
      const sku = config.skus[color] ?? DEFAULT_SKUS[color];
      if (sku) add(sku, 1, l.price);
    }
  }
  return [...bySku.entries()].map(([sku, v]) => ({ sku, qty: v.qty, price: v.price }));
}

/**
 * Place an order on ShopBase BD.
 * Never throws — callers show result.error to the admin in Bengali.
 */
export async function placeShopbaseOrder(
  config: ShopbaseConfig,
  input: SbOrderInput
): Promise<SbResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(SHOPBASE_BASE_URL, {
        method: "POST",
        headers: {
          token: config.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          invoice_id: input.invoiceId,
          order_note: input.orderNote.slice(0, 250),
          is_advance_charge: "no",
          customer: {
            name: input.customerName.slice(0, 100),
            phone: input.phone,
            district: input.district.slice(0, 60),
            shipping_address: input.shippingAddress.slice(0, 250),
          },
          checkout_items: input.items.map((it) => ({
            sku: it.sku,
            qty: it.qty,
            price: it.price,
            // Required by ShopBase; default "F" (Free size) when unset.
            size: it.size ?? "F",
          })),
        }),
        signal: controller.signal,
      });
      const text = (await res.text()).slice(0, 1000);
      let json: { status?: string; message?: string; sbr_order_id?: string } | null =
        null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON body */
      }
      if (
        res.status === 200 &&
        json?.status === "success" &&
        json.sbr_order_id
      ) {
        return { ok: true, sbrOrderId: String(json.sbr_order_id) };
      }
      if (json?.status === "failed") {
        return { ok: false, error: `ShopBase: ${json.message ?? "অর্ডার ব্যর্থ"}` };
      }
      return {
        ok: false,
        error: `ShopBase সাড়া দেয়নি (${res.status})। আবার চেষ্টা করুন।`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, error: "ShopBase-এ সংযোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।" };
  }
}
