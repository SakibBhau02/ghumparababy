import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  buildItemsFromColors,
  buildItemsFromLines,
  findMissingSkus,
  getShopbaseConfig,
  placeShopbaseOrder,
} from "@/lib/shopbase";
import { orderItemsLabel, parseOrderItems } from "@/lib/catalog-shared";
import { buildLabelMap, buildVariantSkuMap } from "@/lib/color-resolve";
import { listCatalogItems } from "@/lib/catalog";
import { getProductConfig } from "@/lib/product";
import { isShopbaseReady } from "@/lib/shopbase-shared";
import { getDeliveryConfig } from "@/lib/delivery";

/**
 * POST /api/admin/shopbase/push — { orderId }
 * One-click push of an order to ShopBase BD. Idempotent: an order that
 * already has a shopbaseOrderId is returned as-is (no double booking).
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const { orderId } = (await req.json()) as { orderId?: unknown };
    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি।" }, { status: 404 });
    }
    if (order.shopbaseOrderId) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        shopbaseOrderId: order.shopbaseOrderId,
      });
    }

    const config = await getShopbaseConfig();
    if (!isShopbaseReady(config)) {
      return NextResponse.json(
        { error: "আগে ShopBase টোকেন দিয়ে টেস্ট করে Connected করুন।" },
        { status: 400 }
      );
    }

    let colors: string[] = [];
    try {
      const parsed = JSON.parse(order.colors) as unknown;
      if (Array.isArray(parsed)) {
        colors = parsed.filter((c): c is string => typeof c === "string");
      }
    } catch {
      colors = [order.color];
    }
    if (colors.length === 0) colors = [order.color];

    const lines = parseOrderItems(order.items);
    // Live catalog: new color variants (cuid ids) resolve their name + own
    // ShopBase SKU from here — the 4-color config table can't know them.
    // FULL list (incl. inactive products/variants) so old orders keep
    // resolving after catalog edits.
    const [catalogItems, productConfig] = await Promise.all([
      listCatalogItems().catch(() => []),
      getProductConfig().catch(() => null),
    ]);
    const labelMap = buildLabelMap(catalogItems, productConfig);
    const variantSkuMap = buildVariantSkuMap(catalogItems);
    // Mixed orders: per-line SKUs (new collection) + color-mapped legacy lines.
    // Pre-items orders: legacy color aggregation (unchanged behavior).
    const items =
      lines.length > 0
        ? buildItemsFromLines(
            config,
            lines.map((l) => ({
              shopbaseSku: l.shopbaseSku,
              qty: l.qty,
              price: l.unitPrice,
              colorIds: l.colorIds,
            })),
            variantSkuMap
          )
        : buildItemsFromColors(config, colors, order.unitPrice, variantSkuMap);
    if (items.length === 0) {
      // Name the exact variant(s) missing an SKU so the admin knows what
      // to fill in the catalog (variant ShopBase SKU) — not a dead-end error.
      const candidateIds = (
        lines.length > 0
          ? lines.flatMap((l) =>
              l.shopbaseSku?.trim() ? [] : (l.colorIds ?? [])
            )
          : colors
      ).filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      );
      const missing = findMissingSkus(config, candidateIds, variantSkuMap);
      const names = missing.map((id) => labelMap[id] ?? id);
      return NextResponse.json(
        {
          error:
            names.length > 0
              ? `এই কালারের SKU পাওয়া যায়নি: ${names.join(", ")} — ক্যাটালগে ওই ভ্যারিয়েন্টের ShopBase SKU বসান।`
              : "এই অর্ডারের কালারের SKU পাওয়া যায়নি — SKU সেটিংস দেখুন।",
        },
        { status: 400 }
      );
    }

    const deliveryConfig = await getDeliveryConfig();
    const zoneLabel =
      deliveryConfig.zones.find((z) => z.id === order.deliveryZone)?.label ?? "";
    // Live-catalog labels — never a raw cuid in the ShopBase note.
    const colorLabels = colors.map((id) => labelMap[id] ?? id).join(", ");

    const address = [order.address, order.upazila, order.district, order.division]
      .filter((s) => s && s.trim().length > 0)
      .join(", ");

    // Customer's own district first — "Dhaka" is only the last-resort
    // fallback ShopBase requires (never override a real customer district).
    const district =
      order.district?.trim() ||
      order.upazila?.trim() ||
      order.division?.trim() ||
      "Dhaka";

    const colorPart = colorLabels.length > 0 ? ` (${colorLabels})` : "";
    const itemsPart = lines.length > 0 ? ` • ${orderItemsLabel(lines)}` : "";

    const result = await placeShopbaseOrder(config, {
      invoiceId: order.orderCode,
      customerName: order.name,
      phone: order.phone,
      district,
      shippingAddress: address,
      orderNote: `${order.packageName}${colorPart}${itemsPart}${zoneLabel ? ` • ${zoneLabel}` : ""}${
        order.adminNote ? ` • ${order.adminNote.slice(0, 80)}` : ""
      }`,
      items,
    });

    if (!result.ok) {
      console.error("shopbase push failed:", order.orderCode, result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const updated = await db.order.update({
      where: { id: order.id },
      data: { shopbaseOrderId: result.sbrOrderId },
    });
    return NextResponse.json({
      ok: true,
      shopbaseOrderId: updated.shopbaseOrderId,
    });
  } catch {
    return NextResponse.json(
      { error: "ShopBase-এ পাঠানো যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
