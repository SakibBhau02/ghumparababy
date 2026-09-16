import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  createCatalogItem,
  getCatalogItem,
  listCatalogItems,
  ensureCatalogSeeded,
  type CatalogItemInput,
} from "@/lib/catalog";

/**
 * GET  /api/admin/catalog — ক্যাটালগ প্রোডাক্ট তালিকা (সিড হলে ডিফল্ট)
 * POST /api/admin/catalog — নতুন প্রোডাক্ট (admin only)
 */

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    await ensureCatalogSeeded();
    const items = await listCatalogItems();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "ক্যাটালগ পড়া যায়নি।" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as CatalogItemInput;
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "প্রোডাক্টের নাম দিন।" },
        { status: 400 }
      );
    }
    const item = await createCatalogItem(body);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "প্রোডাক্ট তৈরি করা যায়নি।" },
      { status: 500 }
    );
  }
}