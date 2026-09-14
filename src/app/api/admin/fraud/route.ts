import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  checkFraudCached,
  getFraudConfig,
  saveFraudConfig,
} from "@/lib/courier-fraud";
import {
  isFraudReady,
  isValidBdPhone,
  normalizeBdPhone,
  sanitizeFraudConfig,
} from "@/lib/fraud-shared";

/**
 * GET  /api/admin/fraud?phone=01XXXXXXXXX[&fresh=1] — check fraud for phone
 * POST /api/admin/fraud — bulk check { phones: string[] } (max 20)
 * PUT  /api/admin/fraud — save fraud config (credentials + autoCheck + fraudbd)
 */

const BULK_MAX = 20;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  if (!isValidBdPhone(phone)) {
    return NextResponse.json(
      { error: "সঠিক ১১ ডিজিটের BD নম্বর দিন (01XXXXXXXXX)।" },
      { status: 400 }
    );
  }
  const config = await getFraudConfig();
  if (!isFraudReady(config)) {
    return NextResponse.json(
      { error: "আগে Settings-এ fraud checker credentials বা FraudBD API key সেভ করুন।" },
      { status: 400 }
    );
  }
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const result = await checkFraudCached(config, phone, { fresh });
  return NextResponse.json({ ok: true, result });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  let phones: string[] = [];
  try {
    const body = (await req.json()) as { phones?: unknown };
    if (!Array.isArray(body.phones)) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const p of body.phones.slice(0, BULK_MAX)) {
      const clean = normalizeBdPhone(String(p ?? ""));
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        phones.push(clean);
      }
    }
  } catch {
    return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
  }
  if (phones.length === 0) {
    return NextResponse.json({ error: "কোনো সঠিক নম্বর পাওয়া যায়নি।" }, { status: 400 });
  }
  const config = await getFraudConfig();
  if (!isFraudReady(config)) {
    return NextResponse.json(
      { error: "আগে Settings-এ fraud checker credentials বা FraudBD API key সেভ করুন।" },
      { status: 400 }
    );
  }
  const settled = await Promise.allSettled(phones.map((p) => checkFraudCached(config, p)));
  const results: Record<string, unknown> = {};
  settled.forEach((r, i) => {
    results[phones[i]] = r.status === "fulfilled" ? r.value : null;
  });
  return NextResponse.json({ ok: true, results });
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { fraud?: unknown };
    if (!body.fraud) {
      return NextResponse.json({ error: "অবৈধ রিকোয়েস্ট।" }, { status: 400 });
    }
    const sane = sanitizeFraudConfig(body.fraud);
    if (!sane) {
      return NextResponse.json({ error: "Fraud config সঠিক নয়।" }, { status: 400 });
    }
    await saveFraudConfig(sane);
    return NextResponse.json({ ok: true, fraud: sane });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি।" },
      { status: 500 }
    );
  }
}
