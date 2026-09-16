import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  deleteCatalogItem,
  getCatalogItem,
  updateCatalogItem,
  type CatalogItemInput,
} from "@/lib/catalog";

/**
 * PUT    /api/admin/catalog/[id] — প্রোডাক্ট আপডেট
 * DELETE /api/admin/catalog/[id] — প্রোডাক্ট ডিলিট (admin only)
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const exists = await getCatalogItem(id);
    if (!exists) {
      return NextResponse.json(
        { error: "প্রোডাক্ট পাওয়া যায়নি।" },
        { status: 404 }
      );
    }
    const body = (await req.json()) as CatalogItemInput;
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "প্রোডাক্টের নাম দিন।" },
        { status: 400 }
      );
    }
    const item = await updateCatalogItem(id, body);
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json(
      { error: "আপডেট করা যায়নি।" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await deleteCatalogItem(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "ডিলিট করা যায়নি।" },
      { status: 500 }
    );
  }
}