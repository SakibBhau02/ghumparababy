import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { manyDialWebhookUrl, requestCallerId, requestOrigin } from "@/lib/manydial";

/** Fields the ManyDial caller-id endpoint requires (excluding hooks/payload). */
const TEXT_FIELDS = [
  "ownerName",
  "businessName",
  "email",
  "phone",
  "nid",
  "dob",
  "gender",
  "fatherName",
  "motherName",
  "flatNo",
  "houseNoOrName",
  "roadNoOrMoholla",
  "areaOrVillage",
  "division",
  "district",
  "upazilaOrThana",
  "postCode",
  "passportSizeImage",
  "signature",
  "seal",
] as const;

/**
 * POST /api/admin/manydial/caller-id — one-time caller ID request.
 * { apiKey, form: { ...TEXT_FIELDS } }
 * The webhook URL + payload + date + smsEnabled are filled server-side.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { apiKey?: unknown; form?: unknown };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "আগে x-api-key দিন — এটা ছাড়া রিকোয়েস্ট যাবে না।" },
        { status: 400 }
      );
    }
    const raw = (body.form ?? {}) as Record<string, unknown>;
    const form: Record<string, string> = {};
    for (const k of TEXT_FIELDS) {
      const v = raw[k];
      if (typeof v === "string" && v.trim()) form[k] = v.trim();
    }
    const missing = TEXT_FIELDS.filter((k) => !form[k]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `ফর্ম অসম্পূর্ণ — বাকি আছে: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const secret = raw.webhookSecret;
    form.date = new Date().toISOString().slice(0, 10);
    form.smsEnabled = "Yes";
    form.callerIdPayload = "ghumparababy-callerid";
    form.callerIdRequestHook =
      typeof secret === "string" && secret
        ? manyDialWebhookUrl(requestOrigin(req), secret) + "&type=callerid"
        : requestOrigin(req) + "/api/manydial/webhook?type=callerid";

    const result = await requestCallerId(apiKey, form);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "রিকোয়েস্ট পাঠানো যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
