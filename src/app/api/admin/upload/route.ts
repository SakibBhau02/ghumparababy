import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  isAllowedImageMime,
  MAX_UPLOAD_BYTES,
  uploadImageToR2,
} from "@/lib/r2-upload";

/**
 * POST /api/admin/upload — multipart image upload → R2 optimized → { url }.
 * Admin only. Accepts a single file under field name "file".
 */

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "ছবি (file) আপলোড করুন।" },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "খালি ফাইল যাবে না।" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "ছবি ১০ MB-এর বেশি যাবে না।" },
        { status: 400 }
      );
    }
    if (!isAllowedImageMime(file.type)) {
      return NextResponse.json(
        { error: "শুধু JPG / PNG / WebP ছবি আপলোড করা যাবে।" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadImageToR2(buffer);
    return NextResponse.json({ ok: true, url }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে।";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}