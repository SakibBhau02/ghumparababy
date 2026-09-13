import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeBdPhone } from "@/lib/phone-shared";

/** Mask a name for public tracking (first letter + ***, e.g. "আ***"). */
function maskName(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "***";
  return `${t[0]}***`;
}

/**
 * GET /api/track?phone=01XXXXXXXXX — public order tracking.
 * Returns limited fields only (no address/phone echo).
 */
export async function GET(req: NextRequest) {
  try {
    const phone = normalizeBdPhone(new URL(req.url).searchParams.get("phone"));
    if (!phone) {
      return NextResponse.json(
        { error: "সঠিক মোবাইল নম্বর দিন। উদাহরণ: 01712345678" },
        { status: 400 }
      );
    }
    const orders = await db.order.findMany({
      where: { phone },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        orderCode: true,
        name: true,
        packageName: true,
        quantity: true,
        totalPrice: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      orders: orders.map((o) => ({ ...o, name: maskName(o.name) })),
    });
  } catch {
    return NextResponse.json(
      { error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
