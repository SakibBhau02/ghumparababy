import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PACKAGES: Record<string, { label: string; quantity: number; unitPrice: number; totalPrice: number }> = {
  single: { label: "সিঙ্গেল (১টি)", quantity: 1, unitPrice: 549, totalPrice: 549 },
  combo2: { label: "কম্বো (২টি)", quantity: 2, unitPrice: 500, totalPrice: 999 },
  combo3: { label: "ফ্যামিলি প্যাক (৩টি)", quantity: 3, unitPrice: 466, totalPrice: 1399 },
};

const COLORS = ["blue", "pink", "red", "beige", "cream", "grey"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, address, color, pkg, note } = body as {
      name?: string;
      phone?: string;
      address?: string;
      color?: string;
      pkg?: string;
      note?: string;
    };

    // --- Validation ---
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে আপনার সঠিক নাম লিখুন।" },
        { status: 400 }
      );
    }

    const cleanPhone = (phone ?? "").replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: "মোবাইল নম্বরটি সঠিক নয়। উদাহরণ: 01712345678" },
        { status: 400 }
      );
    }

    if (!address || address.trim().length < 10) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে সম্পূর্ণ ঠিকানা লিখুন (কমপক্ষে ১০ অক্ষর)।" },
        { status: 400 }
      );
    }

    if (!color || !COLORS.includes(color)) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে একটি কালার নির্বাচন করুন।" },
        { status: 400 }
      );
    }

    if (!pkg || !PACKAGES[pkg]) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে একটি প্যাকেজ নির্বাচন করুন।" },
        { status: 400 }
      );
    }

    const selected = PACKAGES[pkg];
    const totalPrice = selected.totalPrice;

    // Generate a readable order code: GP-YYMMDD-XXXX
    const now = new Date();
    const datePart = `${String(now.getFullYear()).slice(2)}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderCode = `GP-${datePart}-${randomPart}`;

    const order = await db.order.create({
      data: {
        orderCode,
        name: name.trim(),
        phone: cleanPhone,
        address: address.trim(),
        color,
        packageName: selected.label,
        quantity: selected.quantity,
        unitPrice: selected.unitPrice,
        totalPrice,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      totalPrice: order.totalPrice,
      message:
        "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে! আমাদের প্রতিনিধি শীঘ্রই কল করে অর্ডার কনফার্ম করবেন।",
    });
  } catch (err) {
    console.error("Order submission error:", err);
    return NextResponse.json(
      { error: "সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন অথবা সরাসরি কল করুন।" },
      { status: 500 }
    );
  }
}
