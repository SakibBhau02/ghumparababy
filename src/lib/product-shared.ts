/**
 * Pure (client-safe) product pricing — NO server/database imports here.
 * Server-side read/write lives in src/lib/product.ts (Setting.product_config).
 *
 * Model: volume-discount tier table. The price of ONE piece depends on the
 * TOTAL pieces in the order — the more pieces, the cheaper each piece.
 * Admin edits the 10 per-piece tiers + 3 display old-prices; the server
 * recomputes every order from this table so prices can never be tampered
 * with from the client.
 */

import { toBn } from "@/lib/landing-data";

/** Hard cap for new orders (stepper 1..10). Legacy edits may exceed it. */
export const MAX_QTY = 10;

/** 3+ pieces in one order → delivery charge becomes 0 (all zones). */
export const FREE_SHIPPING_MIN_QTY = 3;

/** Per-piece price for total quantity 1..10 (qty 11+ uses the last tier). */
export const DEFAULT_TIERS = [549, 500, 466, 455, 445, 438, 432, 428, 424, 420];

export type DisplayPackageConfig = {
  id: "single" | "combo2" | "combo3";
  oldPrice: number;
};

export type ProductConfig = {
  /** Per-piece price tiers for qty 1..10 (index 0 = 1 pc). */
  tiers: number[];
  /** Display-only old (strikethrough) prices for the 3 website cards. */
  packages: DisplayPackageConfig[];
};

/** Fixed display metadata per package (never edited in admin). */
export const PACKAGE_META: Record<
  DisplayPackageConfig["id"],
  { quantity: number; formName: string; priceName: string; qtyLabel: string; unitSuffix: string }
> = {
  single: {
    quantity: 1,
    formName: "সিঙ্গেল (১টি)",
    priceName: "সিঙ্গেল প্যাক",
    qtyLabel: "১টি সোয়াডেল",
    unitSuffix: "",
  },
  combo2: {
    quantity: 2,
    formName: "কম্বো (২টি)",
    priceName: "কম্বো প্যাক",
    qtyLabel: "২টি সোয়াডেল",
    unitSuffix: " — জনপ্রিয়",
  },
  combo3: {
    quantity: 3,
    formName: "ফ্যামিলি প্যাক (৩টি)",
    priceName: "ফ্যামিলি প্যাক",
    qtyLabel: "৩টি সোয়াডেল",
    unitSuffix: " — সেরা ভ্যালু",
  },
};

export const PACKAGE_IDS = ["single", "combo2", "combo3"] as const;

/** Current live prices — used as defaults until admin saves a change. */
export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  tiers: [...DEFAULT_TIERS],
  packages: [
    { id: "single", oldPrice: 899 },
    { id: "combo2", oldPrice: 1798 },
    { id: "combo3", oldPrice: 2697 },
  ],
};

/** Per-piece + total for a quantity (qty 11+ uses the floor tier). */
export function priceForQty(
  config: ProductConfig,
  qty: number
): { perPiece: number; total: number } {
  const q = Math.max(1, Math.round(qty) || 1);
  const tiers =
    Array.isArray(config.tiers) && config.tiers.length === 10
      ? config.tiers
      : DEFAULT_TIERS;
  const perPiece = tiers[Math.min(q, 10) - 1] ?? DEFAULT_TIERS[9];
  return { perPiece, total: perPiece * q };
}

/** Order/package display name derived from total pieces. */
export function packageNameForQty(qty: number): string {
  const q = Math.max(1, Math.round(qty) || 1);
  if (q === 1) return PACKAGE_META.single.formName;
  if (q === 2) return PACKAGE_META.combo2.formName;
  if (q === 3) return PACKAGE_META.combo3.formName;
  return `মেগা প্যাক (${toBn(q)}টি)`;
}

/** True when this order ships free (volume perk). */
export function isFreeShipping(totalItems: number): boolean {
  return totalItems >= FREE_SHIPPING_MIN_QTY;
}

function sanitizeTiers(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length !== 10) return null;
  const tiers = input.map((v) => Math.round(Number(v)));
  if (tiers.some((t) => !Number.isFinite(t) || t < 0 || t > 99999)) return null;
  // Per-piece price must never rise as quantity grows (no price inversion).
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i] > tiers[i - 1]) return null;
  }
  return tiers;
}

type LegacyPackage = { id?: unknown; price?: unknown; oldPrice?: unknown };

/**
 * Migrate the pre-tier shape { packages: [{ id, price, oldPrice }] }
 * (single/combo2/combo3/custom) into tiers. Admin's 1/2/3-pc prices are
 * preserved; tiers 4..10 fall back to defaults.
 */
function migrateLegacy(packages: unknown[]): ProductConfig | null {
  const byId = new Map<string, LegacyPackage>();
  for (const p of packages) {
    if (p && typeof p === "object") {
      const rec = p as LegacyPackage;
      if (typeof rec.id === "string") byId.set(rec.id, rec);
    }
  }
  const num = (v: unknown, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const single = byId.get("single");
  const combo2 = byId.get("combo2");
  const combo3 = byId.get("combo3");
  if (!single || !combo2 || !combo3) return null;
  const tiers = [...DEFAULT_TIERS];
  tiers[0] = num(single.price, tiers[0]);
  tiers[1] = num(Math.round(num(combo2.price, 999) / 2), tiers[1]);
  tiers[2] = num(Math.round(num(combo3.price, 1399) / 3), tiers[2]);
  return {
    tiers,
    packages: (["single", "combo2", "combo3"] as const).map((id) => ({
      id,
      oldPrice: num(byId.get(id)?.oldPrice, 0),
    })),
  };
}

/** Sanitize anything coming from DB/admin into a valid ProductConfig. */
export function sanitizeProductConfig(input: unknown): ProductConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as { tiers?: unknown; packages?: unknown };

  // New shape: { tiers: number[10], packages: [{ id, oldPrice }] }
  if (rec.tiers !== undefined) {
    const tiers = sanitizeTiers(rec.tiers);
    if (!tiers) return null;
    if (!Array.isArray(rec.packages)) return null;
    const pkgs: DisplayPackageConfig[] = [];
    for (const id of PACKAGE_IDS) {
      const raw = (rec.packages as unknown[]).find(
        (p): p is DisplayPackageConfig =>
          !!p && typeof p === "object" && (p as { id?: unknown }).id === id
      );
      const oldPrice = Math.round(Number((raw as { oldPrice?: unknown } | undefined)?.oldPrice));
      if (!Number.isFinite(oldPrice) || oldPrice < 0 || oldPrice > 999999) return null;
      pkgs.push({ id, oldPrice });
    }
    return { tiers, packages: pkgs };
  }

  // Legacy shape (pre-tier): migrate admin's 1/2/3-pc prices forward.
  if (Array.isArray(rec.packages) && rec.packages.length > 0) {
    return migrateLegacy(rec.packages);
  }
  return null;
}
