/**
 * Live color resolver (client-safe) — the single source of truth for turning a
 * stored color/variant id into a Bangla label, swatch hex and photo.
 *
 * Why this exists: orders store variant ids. New variants added from the admin
 * catalog get cuid ids (e.g. "cmu4861..."), but half the codebase still looked
 * them up in the 4 static PRODUCT_COLORS (blue/pink/red/brown) — so new colors
 * showed up as raw codes. Every consumer must resolve through buildColorMap()
 * (fed with the live catalog) instead of PRODUCT_COLORS directly.
 */

import { PRODUCT_COLORS } from "@/lib/landing-data";
import type { CatalogItem, OrderLineItem } from "@/lib/catalog-shared";
import type { ProductConfig } from "@/lib/product-shared";

export type ColorMeta = {
  /** Bangla display name, e.g. "গোলাপি". Falls back to the raw id. */
  label: string;
  /** Swatch hex ("#CCCCCC" when unknown). */
  hex: string;
  /** Photo URL ("" when unknown). */
  image: string;
};

const UNKNOWN_HEX = "#CCCCCC";

/**
 * Build an id → meta lookup.
 * Priority (later wins): static defaults → admin color list → live catalog
 * variants. Pass the FULL catalog (active + inactive) so old orders keep
 * resolving even after a variant is deactivated.
 */
export function buildColorMap(
  items?: CatalogItem[] | null,
  productConfig?: ProductConfig | null
): Map<string, ColorMeta> {
  const map = new Map<string, ColorMeta>();
  for (const c of PRODUCT_COLORS) {
    map.set(c.id, { label: c.label, hex: c.hex, image: c.image });
  }
  if (productConfig?.colors) {
    for (const c of productConfig.colors) {
      if (!c.id) continue;
      const prev = map.get(c.id);
      map.set(c.id, {
        label: c.label?.trim() || prev?.label || c.id,
        hex: c.hex?.trim() || prev?.hex || UNKNOWN_HEX,
        image: c.image?.trim() || prev?.image || "",
      });
    }
  }
  if (items) {
    for (const item of items) {
      for (const v of item.variants ?? []) {
        if (!v.id) continue;
        const prev = map.get(v.id);
        map.set(v.id, {
          label: v.label?.trim() || v.name?.trim() || prev?.label || v.id,
          hex: v.colorHex?.trim() || prev?.hex || UNKNOWN_HEX,
          image: v.imageUrl?.trim() || item.imageUrl?.trim() || prev?.image || "",
        });
      }
    }
  }
  return map;
}

/** Plain-object version (handy for server routes that need JSON-safe maps). */
export function buildLabelMap(
  items?: CatalogItem[] | null,
  productConfig?: ProductConfig | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, meta] of buildColorMap(items, productConfig)) {
    out[id] = meta.label;
  }
  return out;
}

export function resolveColorMeta(
  map: Map<string, ColorMeta> | undefined | null,
  id: string
): ColorMeta {
  const found = map?.get(id);
  if (found) return found;
  return { label: id, hex: UNKNOWN_HEX, image: "" };
}

/** Stored order.colors JSON → id list (legacy single-color field fallback). */
export function colorIdsFromOrder(o: { colors: string; color: string }): string[] {
  try {
    const arr = JSON.parse(o.colors) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      const ids = arr.filter((c): c is string => typeof c === "string");
      if (ids.length > 0) return ids;
    }
  } catch {
    // fall through to legacy color
  }
  return o.color ? [o.color] : [];
}

/** Human string: "গোলাপি, লাল" (never a raw cuid when the map knows it). */
export function colorLabelsForOrder(
  o: { colors: string; color: string },
  map?: Map<string, ColorMeta> | null
): string {
  return colorIdsFromOrder(o)
    .map((id) => resolveColorMeta(map, id).label)
    .join(", ");
}

/**
 * variantId → its own ShopBase SKU (only when the admin filled it in
 * catalog-manager). Used as first priority when pushing legacy (ঘুমপাড়া)
 * lines to ShopBase — the per-color config table only knows the 4 old ids.
 */
export function buildVariantSkuMap(
  items?: CatalogItem[] | null
): Map<string, string> {
  const map = new Map<string, string>();
  if (items) {
    for (const item of items) {
      for (const v of item.variants ?? []) {
        const sku = v.shopbaseSku?.trim();
        if (v.id && sku) map.set(v.id, sku);
      }
    }
  }
  return map;
}

/**
 * Display photo for a stored order line.
 * - Extra-catalog lines: live catalog item photo (variant photo when the
 *   stored variant/shopbaseSku matches, else the product photo).
 * - Legacy ঘুমপাড়া lines: first color's photo from the color map.
 * - Anything unknown: "" (caller shows a placeholder).
 */
export function resolveLineImage(
  line: OrderLineItem,
  items?: CatalogItem[] | null,
  colorMap?: Map<string, ColorMeta> | null
): string {
  if (line.productId !== "ghumpara" && items) {
    const item = items.find((i) => i.id === line.productId);
    if (item) {
      const variants = item.variants ?? [];
      const match =
        (line.shopbaseSku
          ? variants.find((v) => v.shopbaseSku?.trim() === line.shopbaseSku?.trim())
          : undefined) ??
        (line.variant
          ? variants.find((v) => v.label === line.variant || v.name === line.variant)
          : undefined) ??
        variants.find((v) => v.active);
      return match?.imageUrl?.trim() || item.imageUrl?.trim() || "";
    }
  }
  if (line.productId === "ghumpara" && colorMap) {
    for (const cid of line.colorIds ?? []) {
      const img = colorMap.get(cid)?.image;
      if (img) return img;
    }
  }
  return "";
}
