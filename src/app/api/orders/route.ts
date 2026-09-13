import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDeliveryConfig, zoneCharge } from "@/lib/delivery";
import { appendOrderBackup } from "@/lib/order-backup";
import { loadBdGeo } from "@/lib/bd-geo-server";
import { isValidLocationChain } from "@/lib/bd-geo";
import { getProductConfig } from "@/lib/product";
import { getLocationEnabled } from "@/lib/site-settings";
import { getTelegramConfig, sendNewOrderAlert } from "@/lib/telegram";
import { isTelegramReady } from "@/lib/telegram-shared";
import { sendPurchaseCapi } from "@/lib/capi";
import { getPixelConfig } from "@/lib/pixel-config";
import { isCapiReady } from "@/lib/pixel-shared";
import {
  MAX_QTY,
  isFreeShipping,
  packageNameForQty,
  priceForQty,
} from "@/lib/product-shared";
import { BD_PHONE_EXAMPLE, normalizeBdPhone } from "@/lib/phone-shared";

const COLORS = ["blue", "pink", "red", "beige", "cream", "grey"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, address, division, district, upazila, colors, qty, color, zone } = body as {
      name?: string;
      phone?: string;
      address?: string;
      division?: string;
      district?: string;
      upazila?: string;
      colors?: unknown;
      qty?: unknown;
      color?: string;
      zone?: string;
    };

    // --- Validation ---
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে আপনার সঠিক নাম লিখুন।" },
        { status: 400 }
      );
    }

    const cleanPhone = normalizeBdPhone(phone);
    if (!cleanPhone) {
      return NextResponse.json(
        { error: `সঠিক বাংলাদেশি মোবাইল নম্বর দিন। উদাহরণ: ${BD_PHONE_EXAMPLE}` },
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

    // Quantity stepper (1..MAX_QTY) + volume-discount tier table.
    // Server is the source of truth: per-piece price + total come from tiers.
    const totalItems = Math.min(Math.max(Math.round(Number(qty)) || 0, 1), MAX_QTY);
    const { perPiece, total: productPrice } = priceForQty(productConfig, totalItems);

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

    // --- Delivery charge (server-side source of truth: admin settings) ---
    // Volume perk: 3+ pieces in one order → free delivery (all zones).
    const freeShip = isFreeShipping(totalItems);
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
      deliveryCharge = freeShip ? 0 : zoneCharge(deliveryConfig, zone);
    }

    const totalPrice = productPrice + deliveryCharge;

    // Generate a readable order code: GP-YYMMDD-XXXX
    const now = new Date();
    const datePart = `${String(now.getFullYear()).slice(2)}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderCode = `GP-${datePart}-${randomPart}`;

    // 24h duplicate guard (after full validation, right before create):
    // same number + non-cancelled order in the last 24h → blocked.
    const recent = await db.order.findFirst({
      where: {
        phone: cleanPhone,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { not: "cancelled" },
      },
      select: { orderCode: true },
    });
    if (recent) {
      return NextResponse.json(
        {
          error: "duplicate",
          code: "duplicate",
          orderCode: recent.orderCode,
        },
        { status: 429 }
      );
    }

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
        packageName: packageNameForQty(totalItems),
        quantity: totalItems,
        unitPrice: perPiece,
        deliveryZone,
        deliveryCharge,
        totalPrice,
        status: "pending",
      },
    });

    // Link/update the customer profile (best-effort — never blocks the order)
    try {
      await db.customer.upsert({
        where: { phone: cleanPhone },
        update: {
          name: name.trim(),
          address: address.trim(),
          division: location.division,
          district: location.district,
          upazila: location.upazila,
          orderCount: { increment: 1 },
          totalSpent: { increment: order.totalPrice },
          lastOrderAt: new Date(),
        },
        create: {
          phone: cleanPhone,
          name: name.trim(),
          address: address.trim(),
          division: location.division,
          district: location.district,
          upazila: location.upazila,
          orderCount: 1,
          totalSpent: order.totalPrice,
        },
      });
    } catch (e) {
      console.error("customer upsert failed:", e);
    }

    // Durable backup (append-only ledger + CSV copies) — never blocks the order
    await appendOrderBackup(order);

    // Meta Conversions API: server-side Purchase (never blocks the order).
    // event_id = orderCode dedupes against the browser pixel event.
    try {
      const pixelConfig = await getPixelConfig();
      if (isCapiReady(pixelConfig) && pixelConfig.events.purchase) {
        const fwd = req.headers.get("x-forwarded-for") ?? "";
        const result = await sendPurchaseCapi(pixelConfig, {
          orderCode: order.orderCode,
          totalPrice: order.totalPrice,
          phone: order.phone,
          clientIp: fwd.split(",")[0].trim(),
          userAgent: req.headers.get("user-agent") ?? "",
        });
        if (!result.ok) {
          console.error("capi send failed:", order.orderCode, result.error);
        }
      }
    } catch (e) {
      console.error("capi send crashed:", e);
    }

    // Telegram order alert to admin chat (never blocks the order)
    try {
      const tgConfig = await getTelegramConfig();
      if (isTelegramReady(tgConfig)) {
        let alertColors: string[] = [];
        try {
          const parsed = JSON.parse(order.colors) as unknown;
          if (Array.isArray(parsed)) {
            alertColors = parsed.filter((c): c is string => typeof c === "string");
          }
        } catch {
          alertColors = [order.color];
        }
        const zoneLabel =
          deliveryConfig.zones.find((z) => z.id === deliveryZone)?.label ?? deliveryZone;
        const result = await sendNewOrderAlert(tgConfig, {
          orderCode: order.orderCode,
          name: order.name,
          phone: order.phone,
          address: order.address,
          division: order.division,
          district: order.district,
          upazila: order.upazila,
          packageName: order.packageName,
          colors: alertColors,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          deliveryZoneLabel: zoneLabel,
          deliveryCharge: order.deliveryCharge,
          totalPrice: order.totalPrice,
        });
        if (!result.ok) {
          console.error("telegram send failed:", order.orderCode, result.error);
        }
      }
    } catch (e) {
      console.error("telegram send crashed:", e);
    }

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
