import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDeliveryConfig } from "@/lib/delivery";
import { appendOrderBackup, orderColorIds } from "@/lib/order-backup";
import { loadBdGeo } from "@/lib/bd-geo-server";
import { isValidLocationChain } from "@/lib/bd-geo";
import { getProductConfig } from "@/lib/product";
import { getLocationEnabled } from "@/lib/site-settings";
import { getTelegramConfig, sendNewOrderAlert } from "@/lib/telegram";
import { isTelegramReady } from "@/lib/telegram-shared";
import {
  dispatchConfirmationCall,
  getManyDialConfig,
  manyDialWebhookUrl,
  requestOrigin,
} from "@/lib/manydial";
import { isManyDialReady } from "@/lib/manydial-shared";
import { sendPurchaseCapi } from "@/lib/capi";
import { getPixelConfig } from "@/lib/pixel-config";
import { isCapiReady } from "@/lib/pixel-shared";
import { MAX_QTY } from "@/lib/product-shared";
import {
  orderTrackingSkus,
  recomputeMixed,
  sanitizeNewItems,
  skuLabelForMixed,
} from "@/lib/catalog-shared";
import { BD_PHONE_EXAMPLE, normalizeBdPhone } from "@/lib/phone-shared";
import { HOTLINE } from "@/lib/landing-data";
import { getFraudConfig, warmFraudCache } from "@/lib/courier-fraud";
import { getActiveCatalogItems, getMainProduct } from "@/lib/catalog";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, address, division, district, upazila, colors, qty, color, zone, newItems } = body as {
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
      newItems?: unknown;
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

    // Blacklisted phone (admin-flagged) — no new orders, hotline shown.
    try {
      const flagged = await db.customer.findUnique({
        where: { phone: cleanPhone },
        select: { blacklisted: true },
      });
      if (flagged?.blacklisted) {
        return NextResponse.json(
          { error: `এই নম্বর থেকে এখন অনলাইনে অর্ডার নেওয়া যাচ্ছে না। সমস্যা হলে কল করুন ${HOTLINE}।` },
          { status: 403 }
        );
      }
    } catch {
      // lookup failure must never block an order
    }

    if (!address || address.trim().length < 10) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে সম্পূর্ণ ঠিকানা লিখুন (কমপক্ষে ১০ অক্ষর)।" },
        { status: 400 }
      );
    }

    // --- Prices + toggles (server-side source of truth: admin settings) ---
    const [productConfig, locationEnabled, catalogItems, mainProduct] = await Promise.all([
      getProductConfig(),
      getLocationEnabled(),
      getActiveCatalogItems(),
      getMainProduct(),
    ]);

    // Server-side color whitelist: admin color list + main product variants
    // (single source = product page) — always in sync with the palette.
    const COLORS: string[] = [
      ...new Set([
        ...(productConfig.colors ?? []).map((c) => c.id),
        ...(mainProduct?.variants ?? []).map((v) => v.id),
      ]),
    ];

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

    // Legacy product stepper (0..MAX_QTY). 0 = extra-only order.
    // Server is the source of truth: per-piece price comes from the tier
    // table indexed by TOTAL pieces (see recomputeMixed).
    const oldQty = Math.min(Math.max(Math.round(Number(qty)) || 0, 0), MAX_QTY);

    // One color per legacy item (single color string accepted for backward compat).
    // Ignored entirely when the order has no legacy pieces.
    const pickedColors =
      oldQty > 0
        ? Array.isArray(colors)
          ? colors.filter(
              (c): c is string => typeof c === "string" && COLORS.includes(c)
            )
          : typeof color === "string" && COLORS.includes(color)
            ? [color]
            : []
        : [];
    if (pickedColors.length !== oldQty) {
      return NextResponse.json(
        { error: `অনুগ্রহ করে ${oldQty}টি পিসের জন্য ${oldQty}টি কালার বেছে নিন।` },
        { status: 400 }
      );
    }

    // Extra-product lines (server-truth ids, qty, prices — client can't set prices).
    const newLines = sanitizeNewItems(newItems, catalogItems);
    const totalPieces =
      oldQty + newLines.reduce((s, l) => s + l.qty, 0);
    if (totalPieces < 1) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে কমপক্ষে ১টি পণ্য বেছে নিন।" },
        { status: 400 }
      );
    }

    // --- Delivery charge (server-side source of truth: admin settings) ---
    // Volume perk: 3+ pieces in one order → free delivery (all zones).
    const deliveryConfig = await getDeliveryConfig();
    const needsZone = deliveryConfig.zones.some((z) => z.charge > 0);
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
    }

    // One code path for ALL pricing (legacy-only orders compute identically
    // to before — zero behavior change for the old flow).
    const computed = recomputeMixed({
      productConfig,
      deliveryConfig,
      oldQty,
      oldColors: pickedColors,
      newLines,
      zone: deliveryZone,
      catalogItems,
    });

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
        color: computed.color,
        colors: JSON.stringify(computed.colors),
        packageName: computed.packageName,
        quantity: computed.quantity,
        unitPrice: computed.unitPrice,
        deliveryZone: computed.deliveryZone,
        deliveryCharge: computed.deliveryCharge,
        totalPrice: computed.totalPrice,
        status: "pending",
        items: JSON.stringify(computed.items),
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
    await appendOrderBackup(order, (o) =>
      skuLabelForMixed(productConfig, o.quantity, orderColorIds(o), o.items)
    );

    // Fraud auto-check warmup (best-effort background — never blocks the order).
    // Result lands in the 12h fraud cache, so the admin dashboard order badges
    // and customer profile show it instantly without waiting on courier logins.
    try {
      const fraudConfig = await getFraudConfig();
      if (fraudConfig.enabled && fraudConfig.autoCheck) {
        warmFraudCache(fraudConfig, cleanPhone);
      }
    } catch {
      // warmup failure must never block an order
    }

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
          skus: orderTrackingSkus(
            productConfig,
            computed.quantity,
            pickedColors,
            computed.items
          ),
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
        const newBits = computed.items
          .filter((l) => l.productId !== "ghumpara")
          .map((l) => `${l.name} (${l.variant}) ×${l.qty}`);
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
          itemsText: newBits.length > 0 ? newBits.join(", ") : undefined,
        });
        if (!result.ok) {
          console.error("telegram send failed:", order.orderCode, result.error);
        }
      }
    } catch (e) {
      console.error("telegram send crashed:", e);
    }

    // ManyDial auto confirmation call (never blocks the order).
    // Customer presses 1 = confirm, 2 = cancel → webhook updates the order.
    try {
      const mdConfig = await getManyDialConfig();
      if (isManyDialReady(mdConfig) && mdConfig.autoCall) {
        const result = await dispatchConfirmationCall(mdConfig, {
          callPayload: order.orderCode,
          phone: order.phone,
          webhookUrl: manyDialWebhookUrl(requestOrigin(req), mdConfig.webhookSecret),
        });
        if (!result.ok) {
          console.error("manydial call failed:", order.orderCode, result.error);
        }
      }
    } catch (e) {
      console.error("manydial call crashed:", e);
    }

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      productPrice: computed.productTotal,
      deliveryCharge: order.deliveryCharge,
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
