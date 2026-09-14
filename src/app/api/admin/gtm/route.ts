import { NextRequest, NextResponse } from "next/server";
import { getGtmConfig, saveGtmConfig } from "@/lib/gtm-config";
import {
  extractGtmId,
  sanitizeGtmConfig,
  sanitizeGtmEvents,
} from "@/lib/gtm-shared";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/admin/gtm — বর্তমান GTM কনফিগ
 * PUT /api/admin/gtm — সেভ — admin only
 */

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }
  const config = await getGtmConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      input?: string;
      containerId?: string;
      enabled?: boolean;
      events?: unknown;
    };

    const current = await getGtmConfig();

    let containerId = current.containerId;
    const input =
      typeof body.input === "string" && body.input.trim()
        ? body.input
        : typeof body.containerId === "string" && body.containerId.trim()
          ? body.containerId
          : "";

    if (input.trim()) {
      const extracted = extractGtmId(input);
      if (!extracted) {
        return NextResponse.json(
          {
            error:
              "সঠিক GTM Container ID পাওয়া যায়নি। GTM-XXXXXXX ফরম্যাটে দিন।",
          },
          { status: 400 }
        );
      }
      containerId = extracted;
    }

    const enabled =
      typeof body.enabled === "boolean" ? body.enabled : current.enabled;
    if (enabled && !containerId) {
      return NextResponse.json(
        { error: "Container ID ছাড়া চালু করা যাবে না।" },
        { status: 400 }
      );
    }

    const events = body.events
      ? sanitizeGtmEvents(body.events)
      : current.events;

    const config = sanitizeGtmConfig({ containerId, enabled, events });
    await saveGtmConfig(config);

    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json(
      { error: "সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
