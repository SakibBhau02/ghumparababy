import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryConfig,
  saveDeliveryConfig,
  type DeliveryConfig,
} from "@/lib/delivery";
import { getProductConfig, saveProductConfig } from "@/lib/product";
import {
  sanitizeProductConfig,
  type ProductConfig,
} from "@/lib/product-shared";
import { getLocationEnabled, setLocationEnabled } from "@/lib/site-settings";
import { getWhatsappConfig, saveWhatsappConfig } from "@/lib/whatsapp";
import {
  sanitizeWhatsappConfig,
  type WhatsappConfig,
} from "@/lib/whatsapp-shared";
import { getTelegramConfig, saveTelegramConfig } from "@/lib/telegram";
import {
  sanitizeTelegramConfig,
  type TelegramConfig,
} from "@/lib/telegram-shared";
import { getSteadfastConfig, saveSteadfastConfig } from "@/lib/steadfast";
import {
  sanitizeSteadfastConfig,
  type SteadfastConfig,
} from "@/lib/steadfast-shared";
import { getShopbaseConfig, saveShopbaseConfig } from "@/lib/shopbase";
import {
  sanitizeShopbaseConfig,
  type ShopbaseConfig,
} from "@/lib/shopbase-shared";
import { getManyDialConfig, saveManyDialConfig } from "@/lib/manydial";
import {
  sanitizeManyDialConfig,
  type ManyDialConfig,
} from "@/lib/manydial-shared";
import { getFraudConfig, saveFraudConfig } from "@/lib/courier-fraud";
import {
  sanitizeFraudConfig,
  type FraudConfig,
} from "@/lib/fraud-shared";
import { isAdminRequest } from "@/lib/admin-auth";

const MAX_CHARGE = 999;

/** GET /api/admin/settings — delivery charges + product prices + location toggle */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const [config, products, locationEnabled, whatsapp, telegram, steadfast, shopbase, manydial, fraud] = await Promise.all([
    getDeliveryConfig(),
    getProductConfig(),
    getLocationEnabled(),
    getWhatsappConfig(),
    getTelegramConfig(),
    getSteadfastConfig(),
    getShopbaseConfig(),
    getManyDialConfig(),
    getFraudConfig(),
  ]);
  return NextResponse.json({
    config,
    products,
    locationEnabled,
    whatsapp,
    telegram,
    steadfast,
    shopbase,
    manydial,
    fraud,
  });
}

/**
 * PUT /api/admin/settings — update any of:
 *   { charges }          delivery charges per zone id
 *   { products }         [{ id, price, oldPrice }] package prices
 *   { locationEnabled }  boolean — order-form location block on/off
 */
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      charges?: Record<string, number>;
      notes?: Record<string, unknown>;
      products?: unknown;
      locationEnabled?: unknown;
      whatsapp?: unknown;
      telegram?: unknown;
      steadfast?: unknown;
      shopbase?: unknown;
      manydial?: unknown;
      fraud?: unknown;
    };
    const result: {
      config?: DeliveryConfig;
      products?: ProductConfig;
      locationEnabled?: boolean;
      whatsapp?: WhatsappConfig;
      telegram?: TelegramConfig;
      steadfast?: SteadfastConfig;
      shopbase?: ShopbaseConfig;
      manydial?: ManyDialConfig;
      fraud?: FraudConfig;
    } = {};

    if (body.charges !== undefined || body.notes !== undefined) {
      const charges = body.charges;
      const notes = body.notes;
      if (
        (charges !== undefined && (!charges || typeof charges !== "object")) ||
        (notes !== undefined && (!notes || typeof notes !== "object"))
      ) {
        return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
      }
      const current = await getDeliveryConfig();
      // Update charges + custom notes for existing zones only (labels/ids are fixed)
      const zones = current.zones.map((z) => {
        const raw = charges?.[z.id];
        let charge = z.charge;
        if (raw !== undefined && raw !== null) {
          const parsed = Number(raw);
          charge = Number.isFinite(parsed)
            ? Math.min(Math.max(Math.round(parsed), 0), MAX_CHARGE)
            : 0;
        }
        const rawNote = notes?.[z.id];
        const note =
          typeof rawNote === "string" ? rawNote.trim().slice(0, 140) : z.note;
        return { ...z, charge, note };
      });
      const config: DeliveryConfig = { zones };
      await saveDeliveryConfig(config);
      result.config = config;
    }

    if (body.products !== undefined) {
      const sane = sanitizeProductConfig(body.products);
      if (!sane) {
        return NextResponse.json(
          { error: "দাম ঠিক নেই — প্রতি পিসের দাম পরিমাণ বাড়লে কখনো বাড়তে পারবে না।" },
          { status: 400 }
        );
      }
      await saveProductConfig(sane);
      result.products = sane;
    }

    if (body.locationEnabled !== undefined) {
      if (typeof body.locationEnabled !== "boolean") {
        return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
      }
      await setLocationEnabled(body.locationEnabled);
      result.locationEnabled = body.locationEnabled;
    }

    if (body.whatsapp !== undefined) {
      const sane = sanitizeWhatsappConfig(body.whatsapp);
      if (!sane) {
        return NextResponse.json(
          { error: "WhatsApp সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      await saveWhatsappConfig(sane);
      result.whatsapp = sane;
    }

    if (body.telegram !== undefined) {
      const sane = sanitizeTelegramConfig(body.telegram);
      if (!sane) {
        return NextResponse.json(
          { error: "Telegram সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      await saveTelegramConfig(sane);
      result.telegram = sane;
    }

    if (body.steadfast !== undefined) {
      const sane = sanitizeSteadfastConfig(body.steadfast);
      if (!sane) {
        return NextResponse.json(
          { error: "Steadfast সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      await saveSteadfastConfig(sane);
      result.steadfast = sane;
    }

    if (body.shopbase !== undefined) {
      const sane = sanitizeShopbaseConfig(body.shopbase);
      if (!sane) {
        return NextResponse.json(
          { error: "ShopBase সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      await saveShopbaseConfig(sane);
      result.shopbase = sane;
    }

    if (body.manydial !== undefined) {
      const sane = sanitizeManyDialConfig(body.manydial);
      if (!sane) {
        return NextResponse.json(
          { error: "ManyDial সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      const saved = await saveManyDialConfig(sane);
      result.manydial = saved;
    }

    if (body.fraud !== undefined) {
      const sane = sanitizeFraudConfig(body.fraud);
      if (!sane) {
        return NextResponse.json(
          { error: "Fraud checker সেটিংস সঠিক নয়।" },
          { status: 400 }
        );
      }
      await saveFraudConfig(sane);
      result.fraud = sane;
    }

    if (Object.keys(result).length === 0) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
