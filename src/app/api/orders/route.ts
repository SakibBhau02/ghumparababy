import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDeliveryConfig, zoneCharge } from "@/lib/delivery";
import { appendOrderBackup } from "@/lib/order-backup";
import { loadBdGeo } from "@/lib/bd-geo-server";
import { isValidLocationChain } from "@/lib/bd-geo";
import { getProductConfig } from "@/lib/product";
import { getLocationEnabled } from "@/lib/site-settings";
import { PACKAGE_META, getPackage, perPiecePrice } from "@/lib/product-shared";

const COLORS = ["blue", "pink", "red", "beige", "cream", "grey"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, address, division, district, upazila, colors, multiplier, color, pkg, note, zone } = body as {
      name?: string;
      phone?: string;
      address?: string;
      division?: string;
      district?: string;
      upazila?: string;
      colors?: unknown;
      multiplier?: unknown;
      color?: string;
      pkg?: string;
      note?: string;
      zone?: string;
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

    // --- Prices + toggles (server-side source of truth: admin settings) ---
    const [productConfig, locationEnabled] = await Promise.all([
      getProductConfig(),
      getLocationEnabled(),
    ]);

    // --- Location chain (Division → District → Upazila), admin-toggleable ---
    const location = { division: "", district: "", upazila: "" };
    if (locationEnabled) {
      location.division = (division ?? "").trim();
      location.district = (district ?? "").trim();
      location.upazila = (upazila ?? "").trim();
      try {
        const geo = await loadBdGeo();
        if (!isValidLocationChain(geo, location)) {
          return NextResponse.json(
            { error: "অনুগ্রহ করে সঠিক বিভাগ, জেলা ও উপজেলা নির্বাচন করুন।" },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "এলাকার তথ্য যাচাই করা যায়নি। আবার চেষ্টা করুন।" },
          { status: 500 }
        );
      }
    }

    const selected = getPackage(productConfig, pkg ?? "");
    if (!pkg || !selected) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে একটি প্যাকেজ নির্বাচন করুন।" },
        { status: 400 }
      );
    }

    // Multiplier: same package ×N (1..10)
    const mult = Math.min(Math.max(Math.round(Number(multiplier)) || 1, 1), 10);
    const totalItems = selected.quantity * mult;

    // One color per item (single color string accepted for backward compat)
    const pickedColors = Array.isArray(colors)
      ? colors.filter(
          (c): c is string => typeof c === "string" && COLORS.includes(c)
        )
      : typeof color === "string" && COLORS.includes(color)
        ? [color]
        : [];
    if (pickedColors.length !== totalItems) {
      return NextResponse.json(
        { error: `অনুগ্রহ করে ${totalItems}টি পিসের জন্য ${totalItems}টি কালার বেছে নিন।` },
        { status: 400 }
      );
    }

    const productPrice = selected.price * mult;

    // --- Delivery charge (server-side source of truth: admin settings) ---
    const deliveryConfig = await getDeliveryConfig();
    const needsZone = deliveryConfig.zones.some((z) => z.charge > 0);
    let deliveryCharge = 0;
    let deliveryZone = "";

    if (needsZone) {
      const zoneExists = deliveryConfig.zones.some((z) => z.id === zone);
      if (!zone || !zoneExists) {
        return NextResponse.json(
          { error: "অনুগ্রহ করে ডেলিভারি এলাকা নির্বাচন করুন।" },
          { status: 400 }
        );
      }
      deliveryZone = zone;
      deliveryCharge = zoneCharge(deliveryConfig, zone);
    }

    const totalPrice = productPrice + deliveryCharge;

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
        division: location.division,
        district: location.district,
        upazila: location.upazila,
        color: pickedColors[0],
        colors: JSON.stringify(pickedColors),
        packageName:
          mult > 1
            ? `${PACKAGE_META[selected.id].formName} ×${mult}`
            : PACKAGE_META[selected.id].formName,
        quantity: totalItems,
        unitPrice: perPiecePrice(selected),
        deliveryZone,
        deliveryCharge,
        totalPrice,
        status: "pending",
      },
    });

    // Durable backup (append-only ledger + CSV copies) — never blocks the order
    await appendOrderBackup(order);

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      productPrice,
      deliveryCharge,
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
