import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { checkSteadfastKeys, saveSteadfastConfig } from "@/lib/steadfast";

/**
 * POST /api/admin/courier/check — { apiKey, secretKey }
 * Validates keys via Steadfast get_balance (free, creates nothing),
 * then saves + enables. Mirror of the Telegram "Connect" flow.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  try {
    const { apiKey, secretKey } = (await req.json()) as {
      apiKey?: unknown;
      secretKey?: unknown;
    };
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    const secret = typeof secretKey === "string" ? secretKey.trim() : "";
    if (!key || !secret) {
      return NextResponse.json(
        { error: "Api-Key ও Secret-Key দুটোই দিন।" },
        { status: 400 }
      );
    }
    const check = await checkSteadfastKeys({ enabled: true, apiKey: key, secretKey: secret });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const config = { enabled: true, apiKey: key, secretKey: secret };
    await saveSteadfastConfig(config);
    return NextResponse.json({
      ok: true,
      steadfast: { enabled: true, apiKey: key, secretKey: secret },
      balance: check.balance,
    });
  } catch {
    return NextResponse.json(
      { error: "যাচাই করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
