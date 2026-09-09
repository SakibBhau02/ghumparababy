import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/** GET /api/admin/orders — list all orders (newest first) + summary stats */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
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
    const { id, status } = (await req.json()) as {
      id?: string;
      status?: string;
    };

    if (!id || !status || !STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ ok: true, order });
  } catch {
    return NextResponse.json(
      { error: "আপডেট করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
