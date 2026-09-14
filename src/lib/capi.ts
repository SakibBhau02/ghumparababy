import { createHash } from "node:crypto";
import type { PixelConfig } from "@/lib/pixel-shared";

export type CapiResult = { ok: true } | { ok: false; error: string };

/** SHA-256 hex of normalized phone (Meta requires hashed PII). */
function hashPhone(phone: string): string {
  const normalized = `88${phone.replace(/\D/g, "").replace(/^88/, "")}`.toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Send a server-side Purchase event via Meta Conversions API.
 * event_id = orderCode so Meta dedupes against the browser pixel event
 * (the browser call sends the same eventID — see order-form.tsx).
 * Never throws — callers must not fail the order because of Meta.
 */
export async function sendPurchaseCapi(
  config: PixelConfig,
  order: {
    orderCode: string;
    totalPrice: number;
    phone: string;
    clientIp: string;
    userAgent: string;
    /** Variant SKUs in this order (goes to content_ids + contents). */
    skus?: string[];
  }
): Promise<CapiResult> {
  try {
    const skus = [...new Set((order.skus ?? []).filter(Boolean))];
    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: order.orderCode,
          action_source: "website",
          user_data: {
            ph: [hashPhone(order.phone)],
            client_ip_address: order.clientIp,
            client_user_agent: order.userAgent,
          },
          custom_data: {
            value: order.totalPrice,
            currency: "BDT",
            ...(skus.length > 0
              ? {
                  content_ids: skus,
                  content_type: "product",
                  contents: skus.map((id) => ({ id, quantity: 1 })),
                }
              : {}),
          },
        },
      ],
    };
    if (config.testEventCode) {
      payload.test_event_code = config.testEventCode;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(
        `https://graph.facebook.com/v22.0/${config.pixelId}/events?access_token=${encodeURIComponent(config.capiToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { ok: false, error: `meta ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
