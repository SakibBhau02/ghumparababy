/**
 * Pure (client-safe) product/package config — NO server/database imports here.
 * Server-side read/write lives in src/lib/product.ts (Setting.product_config).
 *
 * Admin panel edits price/oldPrice per package. IDs, names, quantities are
 * fixed in code; the order API re-reads this config server-side so the
 * customer can never tamper with prices.
 */

export type ProductPackageConfig = {
  id: "single" | "combo2" | "combo3" | "custom";
  price: number;
  oldPrice: number;
};

export type ProductConfig = {
  packages: ProductPackageConfig[];
};

/** Fixed display + quantity metadata per package (never edited in admin). */
export const PACKAGE_META: Record<
  ProductPackageConfig["id"],
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
  custom: {
    quantity: 1,
    formName: "কাস্টম",
    priceName: "কাস্টম প্যাক",
    qtyLabel: "পছন্দমতো সংখ্যা",
    unitSuffix: "",
  },
};

export const PACKAGE_IDS = ["single", "combo2", "combo3", "custom"] as const;

/** Current live prices — used as defaults until admin saves a change. */
export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  packages: [
    { id: "single", price: 549, oldPrice: 899 },
    { id: "combo2", price: 999, oldPrice: 1798 },
    { id: "combo3", price: 1399, oldPrice: 2697 },
    { id: "custom", price: 549, oldPrice: 899 },
  ],
};

export function getPackage(
  config: ProductConfig,
  id: string
): (ProductPackageConfig & { quantity: number }) | null {
  const found = config.packages.find((p) => p.id === id);
  if (!found) return null;
  const meta = PACKAGE_META[found.id];
  if (!meta) return null;
  return { ...found, quantity: meta.quantity };
}

/** Per-piece price, rounded (e.g. 999/2 → ৫০০). */
export function perPiecePrice(pkg: { price: number; quantity: number }): number {
  return Math.round(pkg.price / pkg.quantity);
}

/** Sanitize anything coming from DB/admin into a valid ProductConfig. */
export function sanitizeProductConfig(input: unknown): ProductConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as { packages?: unknown };
  if (!Array.isArray(rec.packages) || rec.packages.length === 0) return null;
  const packages: ProductPackageConfig[] = [];
  for (const id of PACKAGE_IDS) {
    const raw = (rec.packages as unknown[]).find(
      (p): p is ProductPackageConfig =>
        !!p && typeof p === "object" && (p as { id?: unknown }).id === id
    );
    const price = Math.min(Math.max(Math.round(Number(raw?.price)), 0), 999999);
    const oldPrice = Math.min(Math.max(Math.round(Number(raw?.oldPrice)), 0), 999999);
    if (!Number.isFinite(price) || !Number.isFinite(oldPrice)) return null;
    packages.push({ id, price, oldPrice });
  }
  return { packages };
}
