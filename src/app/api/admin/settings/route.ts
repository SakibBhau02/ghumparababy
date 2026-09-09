import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryConfig,
  saveDeliveryConfig,
  type DeliveryConfig,
} from "@/lib/delivery";
import { isAdminRequest } from "@/lib/admin-auth";

const MAX_CHARGE = 999;

/** GET /api/admin/settings — current delivery config */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const config = await getDeliveryConfig();
  return NextResponse.json({ config });
}

/** PUT /api/admin/settings — update delivery charges (admin only) */
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      charges?: Record<string, number>;
    };
    const charges = body.charges;
    if (!charges || typeof charges !== "object") {
      return NextResponse.json(
        { error: "অবৈধ রিকোয়েস্ট।" },
        { status: 400 }
      );
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

    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
