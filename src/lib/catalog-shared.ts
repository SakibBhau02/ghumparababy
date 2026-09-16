/**
 * Extra-products catalog (DB-driven; e.g. hooded swaddles) + mixed-order helpers.
 * Pure (client-safe): landing page, order form, admin panel, and API routes
 * all share this file. /api/orders re-validates ids/qty and prices ONLY
 * from here — the client can never set its own prices.
 */

import { siteImage } from "@/lib/site-images";
import {
  isFreeShipping,
  packageNameForQty,
  priceForQty,
  skuLabelForOrder,
  skusForOrder,
  type ProductConfig,
} from "@/lib/product-shared";
import { zoneCharge, type DeliveryConfig } from "@/lib/delivery-shared";

/** Flat per-piece fallback price for extra-catalog items (৳). */
export const NEW_COLLECTION_PRICE = 549;
/** Strikethrough anchor (market premium wraps sell ৳1,000+). */
export const NEW_COLLECTION_OLD_PRICE = 899;
/** Max pieces per extra-catalog product in one order (stock/CRO guard). */
export const NEW_ITEM_MAX_QTY = 5;

export type CatalogProductId = "hooded-brown" | "hooded-pink" | "hooded-blue";

/** Unified catalog product snapshot (display + pricing). */
export type CatalogProduct = {
  id: string;
  /** Display name (shared across the 3 variants). */
  name: string;
  /** Variant label, e.g. "বাদামি". */
  variantLabel: string;
  price: number;
  oldPrice: number;
  image: string;
  /** ShopBase BD product SKU — forward flow sends exactly this. */
  shopbaseSku: string;
  /** Free-size product ("F" = Free). */
  size: string;
};

/** Fixed id of the flagship tier-priced swaddle (seeded). Tier pricing
 *  applies to this product's lines; everything else is flat-priced. There
 *  is no "main" flag — ordering is featured-first, then sortOrder. */
export const MAIN_PRODUCT_ID = "ghumpara-main";

/** DB-driven catalog variant (client-safe, no Prisma fields). */
export type CatalogVariant = {
  id: string;
  name: string;
  label: string;
  colorHex: string;
  imageUrl: string;
  sku: string;
  shopbaseSku: string;
  price: number | null;
  oldPrice: number | null;
  stock: number;
  active: boolean;
  sortOrder: number;
};

/** DB-driven catalog item (client-safe, no Prisma fields). */
export type CatalogItem = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  imageUrl: string;
  price: number;
  oldPrice: number;
  sku: string;
  shopbaseSku: string;
  size: string;
  maxQty: number;
  stock: number;
  /** Pinned to the featured section + top of the extra-products list. */
  featured: boolean;
  /** Order inside the featured section (lower first). */
  featuredOrder: number;
  /** ISO timestamp — product list shows newest first. */
  createdAt: string;
  active: boolean;
  sortOrder: number;
  variants: CatalogVariant[];
};

/** Convert a DB CatalogItem into the flat CatalogProduct snapshot. */
export function catalogItemToProduct(
  item: CatalogItem,
  variantId?: string
): CatalogProduct {
  const variant = variantId
    ? item.variants.find((v) => v.id === variantId && v.active)
    : item.variants.find((v) => v.active);
  return {
    id: item.id,
    name: item.name,
    variantLabel: variant?.name ?? item.name,
    price: variant?.price ?? item.price,
    oldPrice: variant?.oldPrice ?? item.oldPrice,
    image: variant?.imageUrl || item.imageUrl,
    shopbaseSku: variant?.shopbaseSku || item.shopbaseSku,
    size: item.size,
  };
}

/** A selectable buyable line = product (+ variant when one is chosen). */
export type CatalogOrderLine = CatalogProduct & {
  productId: string;
  variantId?: string;
  /** Per-line qty cap (stock/CRO guard). */
  maxQty: number;
  /** Remaining stock; 0 = unlimited (no scarcity badge). */
  stock: number;
  /** Pinned/highlighted by the admin. */
  featured: boolean;
};

/**
 * Flatten DB catalog items into buyable lines, ordered featured-first
 * then newest-first. Each active variant becomes its own line
 * (pricing/SKU from the variant), products without variants
 * fall back to the product itself.
 */
export function flattenCatalog(items: CatalogItem[]): CatalogOrderLine[] {
  const out: CatalogOrderLine[] = [];
  const ordered = [...items].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")
  );
  for (const item of ordered) {
    if (!item.active) continue;
    const activeVariants = item.variants.filter((v) => v.active);
    if (activeVariants.length === 0) {
      const p = catalogItemToProduct(item);
      out.push({
        ...p,
        productId: item.id,
        variantId: undefined,
        maxQty: item.maxQty,
        stock: item.stock,
        featured: item.featured,
      });
    } else {
      for (const v of activeVariants) {
        const p = catalogItemToProduct(item, v.id);
        out.push({
          ...p,
          productId: item.id,
          variantId: v.id,
          maxQty: item.maxQty,
          stock: v.stock > 0 ? v.stock : item.stock,
          featured: item.featured,
        });
      }
    }
  }
  return out;
}

export const NEW_COLLECTION: CatalogProduct[] = [
  {
    id: "hooded-brown",
    name: "হুডি বেবি সোয়াডেল",
    variantLabel: "বাদামি",
    price: NEW_COLLECTION_PRICE,
    oldPrice: NEW_COLLECTION_OLD_PRICE,
    image: siteImage("/images/hooded-swaddle-brown.jpg"),
    shopbaseSku: "33099",
    size: "F",
  },
  {
    id: "hooded-pink",
    name: "হুডি বেবি সোয়াডেল",
    variantLabel: "গোলাপি",
    price: NEW_COLLECTION_PRICE,
    oldPrice: NEW_COLLECTION_OLD_PRICE,
    image: siteImage("/images/hooded-swaddle-pink.jpg"),
    shopbaseSku: "33100",
    size: "F",
  },
  {
    id: "hooded-blue",
    name: "হুডি বেবি সোয়াডেল",
    variantLabel: "আকাশি",
    price: NEW_COLLECTION_PRICE,
    oldPrice: NEW_COLLECTION_OLD_PRICE,
    image: siteImage("/images/hooded-swaddle-blue.jpg"),
    shopbaseSku: "33101",
    size: "F",
  },
];

/**
 * Look up a catalog product by id.
 * If `items` is provided (DB-driven), search there first;
 * otherwise fall back to the static NEW_COLLECTION defaults.
 */
export function getCatalogProduct(
  id: string,
  items?: CatalogItem[]
): CatalogProduct | null {
  if (items?.length) {
    const item = items.find((i) => i.id === id && i.active);
    if (item) return catalogItemToProduct(item);
  }
  return NEW_COLLECTION.find((p) => p.id === id) ?? null;
}

/**
 * Sanitized extra-catalog cart lines from untrusted client input.
 * Pass the DB `items` array to validate against the live catalog.
 * Optional `variantId` selects a specific product variant (pricing/SKU).
 */
export function sanitizeNewItems(
  input: unknown,
  items?: CatalogItem[]
): { id: string; qty: number; variantId?: string }[] {
  if (!Array.isArray(input)) return [];
  const lookup = new Map<string, CatalogItem>();
  if (items?.length) {
    for (const i of items) lookup.set(i.id, i);
  }
  const out: { id: string; qty: number; variantId?: string }[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as { id?: unknown; qty?: unknown; variantId?: unknown };
    if (typeof rec.id !== "string") continue;
    const catalogItem = lookup.get(rec.id);
    const product = catalogItem
      ? catalogItemToProduct(catalogItem, undefined)
      : getCatalogProduct(rec.id);
    if (!product) continue;

    // Variant must exist + be active in the live catalog (else default).
    let variantId: string | undefined;
    if (catalogItem && typeof rec.variantId === "string") {
      variantId = catalogItem.variants.some(
        (v) => v.id === rec.variantId && v.active
      )
        ? rec.variantId
        : undefined;
    }

    const maxQty = catalogItem?.maxQty ?? NEW_ITEM_MAX_QTY;
    const qty = Math.min(
      Math.max(Math.round(Number(rec.qty)) || 0, 0),
      maxQty
    );
    if (qty <= 0) continue;
    const dupKey = `${product.id}::${variantId ?? ""}`;
    if (out.some((l) => `${l.id}::${l.variantId ?? ""}` === dupKey)) continue;
    out.push({ id: product.id, qty, variantId });
  }
  return out;
}

/** Server-truth total for sanitized extra-catalog lines (uniform tier price). */
export function newItemsTotal(
  lines: { id: string; qty: number; variantId?: string }[],
  perPiece: number
): number {
  const pp = Math.max(Math.round(perPiece) || 0, 0);
  return lines.reduce(
    (sum, l) => sum + Math.max(Math.round(l.qty) || 0, 0) * pp,
    0
  );
}

export function newItemsCount(lines: { id: string; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/**
 * One stored line in Order.items (JSON). Covers BOTH the legacy product
 * ("ghumpara", priced by volume tiers) and extra-catalog products
 * (flat price + own ShopBase SKU). Legacy orders have items = "[]".
 */
export type OrderLineItem = {
  productId: string;
  name: string;
  variant: string;
  qty: number;
  unitPrice: number;
  shopbaseSku?: string;
  colorIds?: string[];
};

/** Parse anything (DB string, null, legacy) into line items — never throws. */
export function parseOrderItems(raw: unknown): OrderLineItem[] {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? []);
    const arr = JSON.parse(text) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is OrderLineItem =>
        !!x &&
        typeof x === "object" &&
        typeof (x as OrderLineItem).productId === "string" &&
        typeof (x as OrderLineItem).name === "string" &&
        Number.isFinite((x as OrderLineItem).qty) &&
        (x as OrderLineItem).qty > 0
    );
  } catch {
    return [];
  }
}

/** Split stored lines into legacy-product vs extra-catalog lines. */
export function splitOrderItems(items: OrderLineItem[]): {
  oldLines: OrderLineItem[];
  newLines: OrderLineItem[];
} {
  const oldLines = items.filter((l) => l.productId === "ghumpara");
  const newLines = items.filter((l) => l.productId !== "ghumpara");
  return { oldLines, newLines };
}

/** Short human summary: "ঘুমপাড়া ×২, হুডি বেবি (বাদামি) ×১". */
export function orderItemsLabel(items: OrderLineItem[]): string {
  return items.map((l) => `${l.name}${l.variant ? ` (${l.variant})` : ""} ×${l.qty}`).join(", ");
}

export function orderItemsCount(items: OrderLineItem[]): number {
  return items.reduce((sum, l) => sum + (Math.round(l.qty) || 0), 0);
}

export function orderItemsProductTotal(items: OrderLineItem[]): number {
  return items.reduce((sum, l) => sum + (Math.round(l.qty) || 0) * (Math.round(l.unitPrice) || 0), 0);
}

/**
 * Single source of truth for mixed-cart math (used by POST /api/orders
 * AND admin edit recompute — one code path, no drift).
 *
 * Pricing rules (uniform — settings tier table is the only price engine):
 * - EVERY piece (flagship or extra) costs the tier per-piece price indexed
 *   by TOTAL pieces. More pieces → cheaper per piece, for all products.
 * - 3+ total pieces → free delivery (all zones).
 */
export function recomputeMixed(args: {
  productConfig: ProductConfig;
  deliveryConfig: DeliveryConfig;
  oldQty: number;
  oldColors: string[];
  newLines: { id: string; qty: number; variantId?: string }[];
  zone: string;
  /** Optional DB-driven catalog (supersedes static NEW_COLLECTION pricing). */
  catalogItems?: CatalogItem[];
}): {
  quantity: number;
  unitPrice: number;
  packageName: string;
  colors: string[];
  color: string;
  productTotal: number;
  deliveryCharge: number;
  deliveryZone: string;
  totalPrice: number;
  items: OrderLineItem[];
} {
  const { productConfig, deliveryConfig, zone, catalogItems } = args;
  const oldQty = Math.min(Math.max(Math.round(args.oldQty) || 0, 0), 30);
  const newCount = newItemsCount(args.newLines);
  const totalPieces = oldQty + newCount;
  // Single per-piece price for the whole cart (uniform tier pricing).
  const perPieceAll = priceForQty(
    productConfig,
    Math.min(Math.max(totalPieces, 1), 30)
  ).perPiece;
  const newTotal = newItemsTotal(args.newLines, perPieceAll);

  const oldPerPiece = totalPieces > 0 ? perPieceAll : 0;
  const oldTotal = oldPerPiece * oldQty;
  const productTotal = oldTotal + newTotal;

  const needsZone = deliveryConfig.zones.some((z) => z.charge > 0);
  const deliveryZone = needsZone ? zone : "";
  const deliveryCharge =
    needsZone && zone
      ? isFreeShipping(totalPieces)
        ? 0
        : zoneCharge(deliveryConfig, zone)
      : 0;

  const items: OrderLineItem[] = [];
  if (oldQty > 0) {
    items.push({
      productId: "ghumpara",
      name: "ঘুমপাড়া বেবি সোয়াডেল",
      variant: packageNameForQty(oldQty),
      qty: oldQty,
      unitPrice: oldPerPiece,
      colorIds: args.oldColors,
    });
  }
  for (const l of args.newLines) {
    const dbItem = catalogItems?.find((i) => i.id === l.id);
    const p = dbItem ? catalogItemToProduct(dbItem, l.variantId) : getCatalogProduct(l.id);
    if (!p) continue;
    items.push({
      productId: p.id,
      name: p.name,
      variant: p.variantLabel,
      qty: l.qty,
      unitPrice: perPieceAll,
      shopbaseSku: p.shopbaseSku,
    });
  }

  const firstExtra = items.find((l) => l.productId !== "ghumpara");

  return {
    quantity: totalPieces,
    unitPrice: totalPieces > 0 ? perPieceAll : 0,
    packageName:
      oldQty > 0
        ? packageNameForQty(oldQty)
        : firstExtra
          ? `${firstExtra.name}${firstExtra.variant ? ` (${firstExtra.variant})` : ""}`
          : "এক্সট্রা প্রোডাক্ট",
    colors: args.oldColors,
    color: args.oldColors[0] ?? "",
    productTotal,
    deliveryCharge,
    deliveryZone,
    totalPrice: productTotal + deliveryCharge,
    items,
  };
}

/**
 * Tracking SKUs for Pixel/CAPI content_ids: legacy color SKUs + each
 * extra-catalog line's own ShopBase SKU. Legacy orders → old behavior.
 */
export function orderTrackingSkus(
  productConfig: ProductConfig,
  quantity: number,
  colors: string[],
  itemsRaw: unknown
): string[] {
  const items = parseOrderItems(itemsRaw);
  if (items.length === 0) return skusForOrder(productConfig, quantity, colors);
  const out: string[] = [];
  for (const l of items) {
    if (l.shopbaseSku) {
      if (l.shopbaseSku.trim()) out.push(l.shopbaseSku.trim());
      continue;
    }
    for (const c of l.colorIds ?? []) {
      const sku = skusForOrder(productConfig, l.qty, [c])[0];
      if (sku) out.push(sku);
    }
  }
  return [...new Set(out)];
}

/**
 * Human SKU label for invoice / courier / CSV. Items-aware; falls back
 * to the legacy package×color label for pre-items orders.
 */
export function skuLabelForMixed(
  productConfig: ProductConfig,
  quantity: number,
  colors: string[],
  itemsRaw: unknown
): string {
  const items = parseOrderItems(itemsRaw);
  if (items.length === 0) return skuLabelForOrder(productConfig, quantity, colors);
  const parts: string[] = [];
  for (const l of items) {
    if (l.shopbaseSku) {
      parts.push(`${l.shopbaseSku} ×${l.qty}`);
      continue;
    }
  }
  const oldSkus = skusForOrder(
    productConfig,
    items.filter((l) => l.productId === "ghumpara").reduce((s, l) => s + l.qty, 0) || quantity,
    colors
  );
  return [...parts, ...oldSkus].join(", ");
}
