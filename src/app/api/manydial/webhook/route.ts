import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getManyDialConfig } from "@/lib/manydial";
import { sendAdminText } from "@/lib/telegram";

/**
 * POST /api/manydial/webhook?secret=... — public (ManyDial calls this).
 * Call-automation results: customer pressed 1 → order confirmed,
 * 2 → cancelled, unreachable → admin alert. Always answers 200 so
 * ManyDial does not retry-storm.
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getManyDialConfig();
    const secret = req.nextUrl.searchParams.get("secret") ?? "";
    if (!secret || !config.webhookSecret || secret !== config.webhookSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      callPayload?: unknown;
      userPressed?: unknown;
      status?: unknown;
      duration?: unknown;
    };

    // Caller-ID request status updates (Approved/Rejected) → forward to admin.
    if (req.nextUrl.searchParams.get("type") === "callerid") {
      const snippet = JSON.stringify(body).slice(0, 500);
      await sendAdminText(`📞 ManyDial Caller ID আপডেট এসেছে:\n${snippet}`);
      return NextResponse.json({ ok: true });
    }

    const payload = typeof body.callPayload === "string" ? body.callPayload : "";
    if (!payload.startsWith("GP-")) {
      // TEST calls / unknown payloads — acknowledge silently.
      return NextResponse.json({ ok: true });
    }

    const order = await db.order.findUnique({ where: { orderCode: payload } });
    if (!order) return NextResponse.json({ ok: true });

    const digits = (typeof body.userPressed === "string" ? body.userPressed : "")
      .replace(/\D/g, "");
    const last = digits.slice(-1);
    const callStatus = (
      typeof body.status === "string" ? body.status : ""
    ).toUpperCase();
    const duration = typeof body.duration === "string" ? body.duration : "";

    if (last === "1" || last === "2") {
      const newStatus = last === "1" ? "confirmed" : "cancelled";
      if (order.status === "pending") {
        await db.order.update({
          where: { id: order.id },
          data: { status: newStatus },
        });
      }
      await sendAdminText(
        last === "1"
          ? `✅ কনফার্মেশন কল: কাস্টমার ১ চেপেছে\n\nঅর্ডার ${order.orderCode}\nনাম: ${order.name}\nফোন: ${order.phone}\nমোট: ৳${order.totalPrice}${duration ? `\nকল: ${duration}` : ""}${
              order.status === "pending" ? "\nস্ট্যাটাস: কনফার্মড" : "\n(স্ট্যাটাস আগেই পরিবর্তিত ছিল)"
            }`
          : `❌ কনফার্মেশন কল: কাস্টমার ২ চেপেছে (বাতিল)\n\nঅর্ডার ${order.orderCode}\nনাম: ${order.name}\nফোন: ${order.phone}${duration ? `\nকল: ${duration}` : ""}${
              order.status === "pending" ? "\nস্ট্যাটাস: বাতিল" : "\n(স্ট্যাটাস আগেই পরিবর্তিত ছিল)"
            }`
      );
    } else if (["NO ANSWER", "BUSY", "FAILED"].includes(callStatus)) {
      await sendAdminText(
        `📵 কনফার্মেশন কল ধরা যায়নি (${callStatus})\n\nঅর্ডার ${order.orderCode}\nফোন: ${order.phone}\n\nঅ্যাডমিন প্যানেল থেকে আবার কল পাঠাতে পারেন (📞 বাটন) অথবা সরাসরি কল করুন।`
      );
    } else {
      await sendAdminText(
        `📞 কনফার্মেশন কল সম্পন্ন\n\nঅর্ডার ${order.orderCode}\nফোন: ${order.phone}\nস্ট্যাটাস: ${callStatus || "ANSWER"}${duration ? ` • ${duration}` : ""}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
