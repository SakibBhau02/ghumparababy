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
import { isAdminRequest } from "@/lib/admin-auth";

const MAX_CHARGE = 999;

/** GET /api/admin/settings — delivery charges + product prices + location toggle */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const [config, products, locationEnabled] = await Promise.all([
    getDeliveryConfig(),
    getProductConfig(),
    getLocationEnabled(),
  ]);
  return NextResponse.json({ config, products, locationEnabled });
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
      products?: unknown;
      locationEnabled?: unknown;
    };
    const result: {
      config?: DeliveryConfig;
      products?: ProductConfig;
      locationEnabled?: boolean;
    } = {};

    if (body.charges !== undefined) {
      const charges = body.charges;
      if (!charges || typeof charges !== "object") {
        return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
      }
      const current = await getDeliveryConfig();
      // Update charges for existing zones only (labels/ids are fixed)
      const zones = current.zones.map((z) => {
        const raw = charges[z.id];
        let charge = 0;
        const parsed = raw === undefined || raw === null ? NaN : Number(raw);
        if (Number.isFinite(parsed)) {
          charge = Math.min(Math.max(Math.round(parsed), 0), MAX_CHARGE);
        }
        return { ...z, charge };
      });
      const config: DeliveryConfig = { zones };
      await saveDeliveryConfig(config);
      result.config = config;
    }

    if (body.products !== undefined) {
      const sane = sanitizeProductConfig({ packages: body.products });
      if (!sane) {
        return NextResponse.json(
          { error: "প্যাকেজের দাম সঠিক নয়।" },
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
