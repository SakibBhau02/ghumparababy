import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { getWhatsappConfig, sendOrderConfirmation } from "@/lib/whatsapp";
import { isWhatsappReady } from "@/lib/whatsapp-shared";
import { getProductConfig } from "@/lib/product";
import { getDeliveryConfig } from "@/lib/delivery";
import { getLocationEnabled } from "@/lib/site-settings";
import { loadBdGeo } from "@/lib/bd-geo-server";
import { isValidLocationChain } from "@/lib/bd-geo";
import { recomputeCustomer } from "@/lib/customers";
import { PRODUCT_COLORS } from "@/lib/landing-data";
import { BD_PHONE_EXAMPLE, normalizeBdPhone } from "@/lib/phone-shared";
import {
  parseOrderItems,
  recomputeMixed,
  sanitizeNewItems,
  splitOrderItems,
} from "@/lib/catalog-shared";

const COLOR_IDS: string[] = PRODUCT_COLORS.map((c) => c.id);

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/** GET /api/admin/orders — list all orders (newest first) + summary stats */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  const orders = await db.order.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
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
    const { id, status, pinned, edit } = (await req.json()) as {
      id?: string;
      status?: string;
      pinned?: unknown;
      edit?: unknown;
    };

    if (!id) {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
    }

    // Pin/unpin an order (stays on top of the admin list)
    if (typeof pinned === "boolean" && status === undefined) {
      const order = await db.order.update({
        where: { id },
        data: { pinned },
      });
      return NextResponse.json({ ok: true, order });
    }

    // Full order edit from the admin panel (recomputes all derived totals)
    if (edit !== undefined && status === undefined && pinned === undefined) {
      return handleOrderEdit(id, edit);
    }

    if (!status || !STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: { status },
    });

    // Automatic WhatsApp confirmation message (never blocks the status update)
    let waSent = order.waSent;
    if (status === "confirmed" && !order.waSent) {
      try {
        const waConfig = await getWhatsappConfig();
        if (isWhatsappReady(waConfig)) {
          const result = await sendOrderConfirmation(waConfig, {
            name: order.name,
            phone: order.phone,
            orderCode: order.orderCode,
            packageName: order.packageName,
            quantity: order.quantity,
            totalPrice: order.totalPrice,
          });
          if (result.ok) {
            waSent = true;
            await db.order.update({ where: { id }, data: { waSent: true } });
          } else {
            console.error("whatsapp send failed:", order.orderCode, result.error);
          }
        }
      } catch (e) {
        console.error("whatsapp send crashed:", e);
      }
    }

    return NextResponse.json({ ok: true, order: { ...order, waSent } });
  } catch {
    return NextResponse.json(
      { error: "আপডেট করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/orders?id= — delete an order (admin only). */
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    const prev = await db.order.findUnique({ where: { id } });
    if (!prev) {
      return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি।" }, { status: 404 });
    }
    await db.order.delete({ where: { id } });
    // Tombstone so CSV export (which merges the file ledger) also hides it
    const { addDeletedId } = await import("@/lib/order-backup");
    await addDeletedId(id);
    await recomputeCustomer(prev.phone);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "ডিলিট করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}

const bad = (error: string) =>
  NextResponse.json({ error }, { status: 400 });

/** Validate + apply a full admin edit, recomputing every derived field. */
async function handleOrderEdit(id: string, edit: unknown) {
  const e = (edit ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(e.name);
  const address = str(e.address);
  const cleanPhone = normalizeBdPhone(str(e.phone));
  if (name.length < 2) return bad("সঠিক নাম দিন।");
  if (!cleanPhone) return bad(`সঠিক বাংলাদেশি মোবাইল নম্বর দিন। উদাহরণ: ${BD_PHONE_EXAMPLE}`);
  if (address.length < 10) return bad("সম্পূর্ণ ঠিকানা দিন (কমপক্ষে ১০ অক্ষর)।");

  const [productConfig, deliveryConfig, locationEnabled] = await Promise.all([
    getProductConfig(),
    getDeliveryConfig(),
    getLocationEnabled(),
  ]);

  const prev = await db.order.findUnique({ where: { id } });
  if (!prev) {
    return NextResponse.json({ error: "অর্ডার পাওয়া যায়নি।" }, { status: 404 });
  }

  // Mixed-cart aware recompute: the legacy part comes from the edit, while
  // extra-catalog lines survive untouched (re-sanitized against the catalog).
  // Legacy orders (empty items) behave exactly as before.
  const prevLines = parseOrderItems(prev.items);
  const { oldLines, newLines: prevNew } = splitOrderItems(prevLines);
  const hasOldPart = prevLines.length === 0 || oldLines.length > 0;

  // Quantity stepper for the legacy part (1..30). Legacy orders may exceed
  // MAX_QTY — the floor tier still prices them sensibly.
  let oldQty = 0;
  let picked: string[] = [];
  if (hasOldPart) {
    oldQty = Math.min(Math.max(Math.round(Number(e.qty ?? e.count)) || 1, 1), 30);
    picked = Array.isArray(e.colors)
      ? e.colors.filter(
          (c): c is string => typeof c === "string" && COLOR_IDS.includes(c)
        )
      : [];
    if (picked.length !== oldQty) {
      return bad(`কালার ${oldQty}টি হতে হবে (এখন ${picked.length}টি)।`);
    }
  }
  const keptNew = sanitizeNewItems(
    prevNew.map((l) => ({ id: l.productId, qty: l.qty }))
  );
  if (oldQty + keptNew.reduce((s, l) => s + l.qty, 0) < 1) {
    return bad("কমপক্ষে ১টি পিস থাকতে হবে।");
  }

  const location = { division: "", district: "", upazila: "" };
  if (locationEnabled) {
    location.division = str(e.division);
    location.district = str(e.district);
    location.upazila = str(e.upazila);
    try {
      const geo = await loadBdGeo();
      if (!isValidLocationChain(geo, location)) {
        return bad("সঠিক বিভাগ, জেলা ও উপজেলা দিন।");
      }
    } catch {
      return bad("এলাকার তথ্য যাচাই করা যায়নি।");
    }
  } else {
    location.division = str(e.division);
    location.district = str(e.district);
    location.upazila = str(e.upazila);
  }

  const needsZone = deliveryConfig.zones.some((z) => z.charge > 0);
  let deliveryZone = "";
  if (needsZone) {
    const zid = str(e.zone);
    if (!deliveryConfig.zones.some((z) => z.id === zid)) {
      return bad("ডেলিভারি এলাকা সঠিক নয়।");
    }
    deliveryZone = zid;
  }

  // One code path for ALL pricing (same function the storefront uses).
  const computed = recomputeMixed({
    productConfig,
    deliveryConfig,
    oldQty,
    oldColors: picked,
    newLines: keptNew,
    zone: deliveryZone,
  });

  // Internal admin note (never shown to customers / invoices / courier).
  const adminNote = str(e.note).slice(0, 500);
  const order = await db.order.update({
    where: { id },
    data: {
      name,
      phone: cleanPhone,
      address,
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
      items: JSON.stringify(computed.items),
      adminNote,
    },
  });
  await recomputeCustomer(prev.phone);
  if (cleanPhone !== prev.phone) await recomputeCustomer(cleanPhone);
  return NextResponse.json({ ok: true, order });
}
