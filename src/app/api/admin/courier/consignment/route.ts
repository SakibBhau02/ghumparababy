import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { createConsignment, getSteadfastConfig } from "@/lib/steadfast";
import { isSteadfastReady } from "@/lib/steadfast-shared";
import { getDeliveryConfig } from "@/lib/delivery";
import { getProductConfig } from "@/lib/product";
import { skuLabelForOrder } from "@/lib/product-shared";
import { PRODUCT_COLORS } from "@/lib/landing-data";

/**
 * POST /api/admin/courier/consignment — { orderId }
 * One-click Steadfast consignment for an order. Idempotent: if the order
 * already has a consignmentId it is returned as-is (no double booking).
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
    if (order.consignmentId) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        consignmentId: order.consignmentId,
        trackingCode: order.trackingCode,
      });
    }

    const config = await getSteadfastConfig();
    if (!isSteadfastReady(config)) {
      return NextResponse.json(
        { error: "আগে Steadfast Api-Key + Secret-Key দিয়ে Check করুন।" },
        { status: 400 }
      );
    }

    const deliveryConfig = await getDeliveryConfig();
    const zoneLabel =
      deliveryConfig.zones.find((z) => z.id === order.deliveryZone)?.label ?? "";    let colors: string[] = [];
    try {
      const parsed = JSON.parse(order.colors) as unknown;
      if (Array.isArray(parsed)) {
        colors = parsed.filter((c): c is string => typeof c === "string");
      }
    } catch {
      colors = [order.color];
    }
    const colorLabels = colors.map(
      (id) => PRODUCT_COLORS.find((c) => c.id === id)?.label ?? id
    );

    const address = [order.address, order.upazila, order.district, order.division]
      .filter((s) => s && s.trim().length > 0)
      .join(", ");

    const productConfig = await getProductConfig();
    const sku = skuLabelForOrder(productConfig, order.quantity, colors);

    const result = await createConsignment(config, {
      invoice: order.orderCode,
      recipientName: order.name,
      recipientPhone: order.phone,
      recipientAddress: address,
      codAmount: order.totalPrice,
      note: zoneLabel,
      itemDescription: `${order.packageName} (${colorLabels.join(", ")})${sku ? ` [SKU: ${sku}]` : ""}`,
    });

    if (!result.ok) {
      console.error("steadfast create failed:", order.orderCode, result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const updated = await db.order.update({
      where: { id: order.id },
      data: { consignmentId: result.consignmentId, trackingCode: result.trackingCode },
    });
    return NextResponse.json({
      ok: true,
      consignmentId: updated.consignmentId,
      trackingCode: updated.trackingCode,
    });
  } catch {
    return NextResponse.json(
      { error: "কুরিয়ারে পাঠানো যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
