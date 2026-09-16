/**
 * DB-driven product catalog (server-only). Landing page, order form and
 * order API all read from here; admin CRUDs through this. Client-safe
 * pure types/helpers live in src/lib/catalog-shared.ts.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PRODUCT_COLORS } from "@/lib/landing-data";
import { getProductConfig } from "@/lib/product";
import {
  MAIN_PRODUCT_ID,
  type CatalogItem,
  type CatalogVariant,
} from "@/lib/catalog-shared";

export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true };
}>;

/** Convert a Prisma Product row into the client-safe CatalogItem shape. */
export function productToCatalogItem(p: ProductWithVariants): CatalogItem {
  return {
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    oldPrice: p.oldPrice,
    sku: p.sku,
    shopbaseSku: p.shopbaseSku,
    size: p.size,
    maxQty: p.maxQty,
    stock: p.stock,
    featured: p.featured,
    featuredOrder: p.featuredOrder,
    createdAt: p.createdAt.toISOString(),
    active: p.active,
    sortOrder: p.sortOrder,
    variants: [...p.variants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v) => ({
        id: v.id,
        name: v.name,
        label: v.label,
        colorHex: v.colorHex,
        imageUrl: v.imageUrl,
        sku: v.sku,
        shopbaseSku: v.shopbaseSku,
        price: v.price,
        oldPrice: v.oldPrice,
        stock: v.stock,
        active: v.active,
        sortOrder: v.sortOrder,
      })),
  };
}

const includeVariants = { variants: { orderBy: { sortOrder: "asc" as const } } };

export async function listCatalogItems(options?: {
  onlyActive?: boolean;
  featuredOnly?: boolean;
}): Promise<CatalogItem[]> {
  const rows = await db.product.findMany({
    where: {
      ...(options?.onlyActive ? { active: true } : {}),
      ...(options?.featuredOnly ? { featured: true } : {}),
    },
    include: includeVariants,
    // Featured first, then newest first (no manual sort key).
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(productToCatalogItem);
}

export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
  const row = await db.product.findUnique({
    where: { id },
    include: includeVariants,
  });
  return row ? productToCatalogItem(row) : null;
}

/**
 * First-run seed: the flagship swaddle (1 product + color variants).
 * No-op once it exists. Extra products are added from the admin panel.
 */
export async function ensureCatalogSeeded(): Promise<void> {
  const mainCount = await db.product.count({ where: { id: MAIN_PRODUCT_ID } });
  if (mainCount === 0) {
    // Variants mirror the live admin color list (falls back to defaults).
    let liveColors: { id: string; label: string; hex: string; image: string }[] =
      PRODUCT_COLORS.map((c) => ({ ...c }));
    try {
      const cfg = await getProductConfig();
      if (cfg.colors && cfg.colors.length > 0) liveColors = cfg.colors.map((c) => ({ ...c }));
    } catch {
      // fall back to static defaults
    }
    await db.product.create({
      data: {
        id: "ghumpara-main",
        name: "ঘুমপাড়া বেবি সোয়াডেল",
        tagline: "মোরো রিফ্লেক্স প্রিভেনশন সোয়াডেল",
        price: 499,
        oldPrice: 899,
        size: "F",
        maxQty: 30,
        featured: false,
        active: true,
        sortOrder: 0,
        variants: {
          create: liveColors.map((c, i) => ({
            // Fixed ids mirror the legacy color ids ("blue", "pink", …) so
            // tier SKUs, order colors and history keep working unchanged.
            id: c.id,
            name: c.label,
            label: c.label,
            colorHex: c.hex,
            imageUrl: c.image,
            sortOrder: i + 1,
          })),
        },
      },
    });
  }
}

/** Admin input for create/update — variants may carry optional id (edit). */
export type CatalogItemInput = {
  name: string;
  tagline?: string;
  description?: string;
  imageUrl?: string;
  price: number;
  oldPrice?: number;
  sku?: string;
  shopbaseSku?: string;
  size?: string;
  maxQty?: number;
  stock?: number;
  featured?: boolean;
  featuredOrder?: number;
  active?: boolean;
  sortOrder?: number;
  variants?: {
    id?: string;
    name: string;
    label?: string;
    colorHex?: string;
    imageUrl?: string;
    sku?: string;
    shopbaseSku?: string;
    price?: number | null;
    oldPrice?: number | null;
    stock?: number;
    active?: boolean;
    sortOrder?: number;
  }[];
};

const num = (v: unknown, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const bool = (v: unknown): boolean => v === true;
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v.trim() : fallback;

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  const row = await db.product.create({
    data: {
      name: str(input.name, "নতুন প্রোডাক্ট"),
      tagline: str(input.tagline),
      description: str(input.description),
      imageUrl: str(input.imageUrl),
      price: num(input.price, 0),
      oldPrice: num(input.oldPrice, 0),
      sku: str(input.sku),
      shopbaseSku: str(input.shopbaseSku),
      size: str(input.size, "F") || "F",
      maxQty: num(input.maxQty, 5) || 5,
      stock: num(input.stock, 0),
      featured: bool(input.featured),
      featuredOrder: num(input.featuredOrder, 0),
      active: input.active === undefined ? true : bool(input.active),
      sortOrder: num(input.sortOrder, 0),
        variants: {
          create: (input.variants ?? []).map((v, i) => ({
            name: str(v.name, `ভ্যারিয়েন্ট ${i + 1}`),
            label: str(v.label),
            colorHex: str(v.colorHex),
            imageUrl: str(v.imageUrl),
            sku: str(v.sku),
            shopbaseSku: str(v.shopbaseSku),
            price: v.price === null ? null : num(v.price, 0),
            oldPrice: v.oldPrice === null ? null : num(v.oldPrice, 0),
          stock: num(v.stock, 0),
          active: v.active === undefined ? true : bool(v.active),
          sortOrder: i,
          })),
        },
      },
      include: includeVariants,
    });
  return productToCatalogItem(row);
}

export async function updateCatalogItem(
  id: string,
  input: CatalogItemInput
): Promise<CatalogItem> {
  const incomingIds = (input.variants ?? [])
    .map((v) => (v.id ? str(v.id) : ""))
    .filter(Boolean);

  await db.$transaction([
    // Drop variants removed by the admin.
    db.productVariant.deleteMany({
      where: { productId: id, NOT: { id: { in: incomingIds } } },
    }),
    // Update product fields.
    db.product.update({
      where: { id },
      data: {
        name: str(input.name, "নতুন প্রোডাক্ট"),
        tagline: str(input.tagline),
        description: str(input.description),
        imageUrl: str(input.imageUrl),
        price: num(input.price, 0),
        oldPrice: num(input.oldPrice, 0),
        sku: str(input.sku),
        shopbaseSku: str(input.shopbaseSku),
        size: str(input.size, "F") || "F",
        maxQty: num(input.maxQty, 5) || 5,
        stock: num(input.stock, 0),
        featured: bool(input.featured),
        featuredOrder: num(input.featuredOrder, 0),
        active: input.active === undefined ? true : bool(input.active),
        sortOrder: num(input.sortOrder, 0),
      },
    }),
  ]);

  for (const [i, v] of (input.variants ?? []).entries()) {
    const data = {
      name: str(v.name, `ভ্যারিয়েন্ট ${i + 1}`),
      label: str(v.label),
      colorHex: str(v.colorHex),
      imageUrl: str(v.imageUrl),
      sku: str(v.sku),
      shopbaseSku: str(v.shopbaseSku),
      price: v.price === null ? null : num(v.price, 0),
      oldPrice: v.oldPrice === null ? null : num(v.oldPrice, 0),
      stock: num(v.stock, 0),
      active: v.active === undefined ? true : bool(v.active),
      sortOrder: num(v.sortOrder, i),
    };
    if (v.id) {
      await db.productVariant.update({ where: { id: v.id }, data });
    } else {
      await db.productVariant.create({
        data: { ...data, productId: id },
      });
    }
  }

  const row = await db.product.findUniqueOrThrow({
    where: { id },
    include: includeVariants,
  });
  return productToCatalogItem(row);
}

export async function deleteCatalogItem(id: string): Promise<void> {
  await db.product.delete({ where: { id } });
}

/** Active catalog items for the order form + validation (any flags). */
export async function getActiveCatalogItems(): Promise<CatalogItem[]> {
  const rows = await db.product.findMany({
    where: { active: true },
    include: includeVariants,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(productToCatalogItem);
}

/** Featured items for the special-offer section (ordered, excluding main). */
export async function getFeaturedItems(): Promise<CatalogItem[]> {
  const rows = await db.product.findMany({
    where: { active: true, featured: true, NOT: { id: MAIN_PRODUCT_ID } },
    include: includeVariants,
    orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(productToCatalogItem);
}

/** The flagship tier-priced swaddle (fixed seed id) with its color variants. */
export async function getMainProduct(): Promise<CatalogItem | null> {
  const row = await db.product.findUnique({
    where: { id: MAIN_PRODUCT_ID },
    include: includeVariants,
  });
  if (!row || !row.active) return null;
  return productToCatalogItem(row);
}

/** Variant type re-export for admin/client consumers. */
export type { CatalogVariant };