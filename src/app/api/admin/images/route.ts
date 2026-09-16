import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  getSiteImages,
  saveSiteImages,
} from "@/lib/site-config";
import {
  SITE_IMAGE_SLOTS,
  sanitizeSiteImagesConfig,
  type SiteImagesConfig,
} from "@/lib/site-images-config";

/**
 * GET  /api/admin/images — বর্তমান সাইট ইমেজ কনফিগ
 * PUT  /api/admin/images — সেভ (admin only)
 */

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const config = await getSiteImages();
  return NextResponse.json({ config, slots: SITE_IMAGE_SLOTS });
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const config = sanitizeSiteImagesConfig(body as SiteImagesConfig);
    await saveSiteImages(config);
    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}