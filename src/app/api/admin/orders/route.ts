import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { getWhatsappConfig, sendOrderConfirmation } from "@/lib/whatsapp";
import { isWhatsappReady } from "@/lib/whatsapp-shared";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/** GET /api/admin/orders — list all orders (newest first) + summary stats */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  const orders = await db.order.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    revenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalPrice, 0),
    deliveredRevenue: orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + o.totalPrice, 0),
  };

  return NextResponse.json({ orders, stats });
}

/** PATCH /api/admin/orders — update an order's status */
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const { id, status, pinned } = (await req.json()) as {
      id?: string;
      status?: string;
      pinned?: unknown;
    };

    if (!id) {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
    }

    // Pin/unpin an order (stays on top of the admin list)
    if (typeof pinned === "boolean" && status === undefined) {
      const order = await db.order.update({
        where: { id },
        data: { pinned },
      });
      return NextResponse.json({ ok: true, order });
    }

    if (!status || !STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: { status },
    });

    // Automatic WhatsApp confirmation message (never blocks the status update)
    let waSent = order.waSent;
    if (status === "confirmed" && !order.waSent) {
      try {
        const waConfig = await getWhatsappConfig();
        if (isWhatsappReady(waConfig)) {
          const result = await sendOrderConfirmation(waConfig, {
            name: order.name,
            phone: order.phone,
            orderCode: order.orderCode,
            packageName: order.packageName,
            quantity: order.quantity,
            totalPrice: order.totalPrice,
          });
          if (result.ok) {
            waSent = true;
            await db.order.update({ where: { id }, data: { waSent: true } });
          } else {
            console.error("whatsapp send failed:", order.orderCode, result.error);
          }
        }
      } catch (e) {
        console.error("whatsapp send crashed:", e);
      }
    }

    return NextResponse.json({ ok: true, order: { ...order, waSent } });
  } catch {
    return NextResponse.json(
      { error: "আপডেট করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
