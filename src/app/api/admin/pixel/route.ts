import { NextRequest, NextResponse } from "next/server";
import { getPixelConfig, savePixelConfig } from "@/lib/pixel-config";
import {
  extractPixelId,
  sanitizePixelConfig,
  sanitizePixelEvents,
} from "@/lib/pixel-shared";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/admin/pixel — বর্তমান Meta Pixel কনফিগ
 * PUT /api/admin/pixel — সেভ (ID/কোড পেস্ট, চালু-বন্ধ, ইভেন্ট টগল) — admin only
 */

/** GET: বর্তমান কনফিগ (লগইন ছাড়া 401) */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const config = await getPixelConfig();
  return NextResponse.json({ config });
}

/** PUT: কনফিগ সেভ — body: { input?, pixelId?, enabled?, events?, capiToken?, testEventCode? } */
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      input?: string; // ইউজারের পেস্ট করা ID অথবা পুরো pixel code
      pixelId?: string; // সরাসরি ID (input না দিলে)
      enabled?: boolean;
      events?: unknown;
      capiToken?: unknown; // Conversions API access token
      testEventCode?: unknown; // Test Events ট্যাবের কোড (optional)
    };

    const current = await getPixelConfig();

    // ১) Pixel ID নির্ধারণ: নতুন input > সরাসরি pixelId > আগের সংরক্ষিত ID
    let pixelId = current.pixelId;
    const input =
      typeof body.input === "string" && body.input.trim()
        ? body.input
        : typeof body.pixelId === "string" && body.pixelId.trim()
          ? body.pixelId
          : "";

    if (input.trim()) {
      const extracted = extractPixelId(input);
      if (!extracted) {
        return NextResponse.json(
          {
            error:
              "পেস্ট করা টেক্সট থেকে সঠিক Pixel ID পাওয়া যায়নি। Pixel ID সাধারণত ১৫-১৬ ডিজিটের সংখ্যা।",
          },
          { status: 400 }
        );
      }
      pixelId = extracted;
    }

    // ২) চালু/বন্ধ অবস্থা
    const enabled =
      typeof body.enabled === "boolean" ? body.enabled : current.enabled;
    if (enabled && !pixelId) {
      return NextResponse.json(
        { error: "Pixel ID ছাড়া সংযোগ চালু করা যাবে না। আগে ID দিন।" },
        { status: 400 }
      );
    }

    // ৩) ইভেন্ট কনফিগ (অজানা key/মান বাদ)
    const events = body.events
      ? sanitizePixelEvents(body.events)
      : current.events;

    // ৪) Conversions API token + test event code (দুটোই optional)
    const capiToken =
      body.capiToken !== undefined
        ? String(body.capiToken).trim().slice(0, 500)
        : current.capiToken;
    const testEventCode =
      body.testEventCode !== undefined
        ? String(body.testEventCode).trim().slice(0, 64)
        : current.testEventCode;

    const config = sanitizePixelConfig({ pixelId, enabled, events, capiToken, testEventCode });
    await savePixelConfig(config);

    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
