import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/admin/customers — fresh customer list (refresh support).
 * GET /api/admin/customers?phone=... — single customer + their orders.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const phone = req.nextUrl.searchParams.get("phone");
  if (phone) {
    const customer = await db.customer.findUnique({ where: { phone } });
    if (!customer) {
      return NextResponse.json({ error: "কাস্টমার পাওয়া যায়নি।" }, { status: 404 });
    }
    const orders = await db.order.findMany({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ customer, orders });
  }
  const customers = await db.customer.findMany({
    orderBy: { lastOrderAt: "desc" },
  });
  return NextResponse.json({ customers });
}

const MAX_NOTE = 1000;
const MAX_TAG = 30;
const MAX_TAGS = 10;

/**
 * PATCH /api/admin/customers — { phone, patch: { tags?, note?, blacklisted?, email? } }
 * Only the admin-editable fields; aggregates are recomputed from orders elsewhere.
 */
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      phone?: unknown;
      patch?: Record<string, unknown>;
    };
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    const customer = await db.customer.findUnique({ where: { phone } });
    if (!customer) {
      return NextResponse.json({ error: "কাস্টমার পাওয়া যায়নি।" }, { status: 404 });
    }

    const data: Partial<{
      tags: string;
      note: string;
      blacklisted: boolean;
      email: string;
    }> = {};

    if (body.patch?.tags !== undefined) {
      const raw = body.patch.tags;
      if (!Array.isArray(raw)) {
        return NextResponse.json({ error: "ট্যাগ সঠিক নয়।" }, { status: 400 });
      }
      const tags = [
        ...new Set(
          raw
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().slice(0, MAX_TAG))
            .filter((t) => t.length > 0)
        ),
      ].slice(0, MAX_TAGS);
      data.tags = JSON.stringify(tags);
    }

    if (body.patch?.note !== undefined) {
      if (typeof body.patch.note !== "string") {
        return NextResponse.json({ error: "নোট সঠিক নয়।" }, { status: 400 });
      }
      data.note = body.patch.note.trim().slice(0, MAX_NOTE);
    }

    if (body.patch?.blacklisted !== undefined) {
      if (typeof body.patch.blacklisted !== "boolean") {
        return NextResponse.json({ error: "ব্ল্যাকলিস্ট মান সঠিক নয়।" }, { status: 400 });
      }
      data.blacklisted = body.patch.blacklisted;
    }

    if (body.patch?.email !== undefined) {
      const email = typeof body.patch.email === "string" ? body.patch.email.trim() : "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "ইমেইল ঠিক নয়।" }, { status: 400 });
      }
      data.email = email.slice(0, 128);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "কিছু পরিবর্তন দেওয়া হয়নি।" }, { status: 400 });
    }

    const updated = await db.customer.update({
      where: { phone },
      data,
    });
    return NextResponse.json({ ok: true, customer: updated });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
