import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/live-count — আজকের অর্ডার সংখ্যা (ল্যান্ডিং পেজের "লাইভ" ব্যাজ)।
 * Public and cheap: one indexed count query, cached briefly by the client.
 */
export async function GET() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const count = await db.order.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: null }, { status: 200 });
  }
}

export const dynamic = "force-dynamic";