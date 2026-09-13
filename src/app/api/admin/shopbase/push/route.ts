import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  buildItemsFromColors,
  getShopbaseConfig,
  placeShopbaseOrder,
} from "@/lib/shopbase";
import { isShopbaseReady } from "@/lib/shopbase-shared";
import { getDeliveryConfig } from "@/lib/delivery";
import { PRODUCT_COLORS } from "@/lib/landing-data";

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

    const items = buildItemsFromColors(config, colors, order.unitPrice);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "এই অর্ডারের কালারের SKU পাওয়া যায়নি — SKU সেটিংস দেখুন।" },
        { status: 400 }
      );
    }

    const deliveryConfig = await getDeliveryConfig();
    const zoneLabel =
      deliveryConfig.zones.find((z) => z.id === order.deliveryZone)?.label ?? "";
    const colorLabels = colors
      .map((id) => PRODUCT_COLORS.find((c) => c.id === id)?.label ?? id)
      .join(", ");

    const address = [order.address, order.upazila, order.district, order.division]
      .filter((s) => s && s.trim().length > 0)
      .join(", ");

    const result = await placeShopbaseOrder(config, {
      invoiceId: order.orderCode,
      customerName: order.name,
      phone: order.phone,
      district: order.district || order.division || "Dhaka",
      shippingAddress: address,
      orderNote: `${order.packageName} (${colorLabels})${zoneLabel ? ` • ${zoneLabel}` : ""}${
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
