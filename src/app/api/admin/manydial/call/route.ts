import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  dispatchConfirmationCall,
  getManyDialConfig,
  manyDialWebhookUrl,
  requestOrigin,
} from "@/lib/manydial";
import { isManyDialReady } from "@/lib/manydial-shared";

/**
 * POST /api/admin/manydial/call — { orderId }
 * Manual re-send of the confirmation call for an order (e.g. customer
 * didn't pick up the auto-call). Uses the SAVED config.
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
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "শুধু পেন্ডিং অর্ডারে কনফার্মেশন কল যাবে।" },
        { status: 400 }
      );
    }

    const config = await getManyDialConfig();
    if (!isManyDialReady(config)) {
      return NextResponse.json(
        { error: "আগে ManyDial x-api-key + Caller ID দিয়ে টেস্ট করুন।" },
        { status: 400 }
      );
    }

    const result = await dispatchConfirmationCall(config, {
      callPayload: order.orderCode,
      phone: order.phone,
      webhookUrl: manyDialWebhookUrl(requestOrigin(req), config.webhookSecret),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "কল পাঠানো যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
