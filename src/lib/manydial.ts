import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  DEFAULT_MANYDIAL_CONFIG,
  sanitizeManyDialConfig,
  type ManyDialConfig,
} from "@/lib/manydial-shared";
import { HOTLINE } from "@/lib/landing-data";

export const MANYDIAL_SETTING_KEY = "manydial_config";
export const MANYDIAL_BASE_URL = "https://api.manydial.com/v1/portal";

/** Read ManyDial config from DB (safe defaults on any problem). */
export async function getManyDialConfig(): Promise<ManyDialConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: MANYDIAL_SETTING_KEY },
    });
    if (!row) return DEFAULT_MANYDIAL_CONFIG;
    return sanitizeManyDialConfig(JSON.parse(row.value)) ?? DEFAULT_MANYDIAL_CONFIG;
  } catch {
    return DEFAULT_MANYDIAL_CONFIG;
  }
}

/** Persist ManyDial config (admin only). Generates a webhook secret if missing. */
export async function saveManyDialConfig(config: ManyDialConfig): Promise<ManyDialConfig> {
  const sane =
    sanitizeManyDialConfig(config) ??
    (() => {
      throw new Error("invalid manydial config");
    })();
  if (!sane.webhookSecret) {
    sane.webhookSecret = crypto.randomUUID().replace(/-/g, "");
  }
  await db.setting.upsert({
    where: { key: MANYDIAL_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: MANYDIAL_SETTING_KEY, value: JSON.stringify(sane) },
  });
  return sane;
}

/** Public webhook URL ManyDial posts call results to (secret-verified). */
export function manyDialWebhookUrl(origin: string, secret: string): string {
  return `${origin}/api/manydial/webhook?secret=${encodeURIComponent(secret)}`;
}

/** Derive the site's public origin from an incoming request (Vercel-safe). */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!host) return "https://ghumparababy.vercel.app";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return isLocal ? `http://${host}` : `https://${host}`;
}

export type MdCallResult =
  | { ok: true }
  | { ok: false; error: string };

/** Bengali voice-flow for order confirmation. 1 = confirm, 2 = cancel. */
function buildMessages(orderCode: string): Record<string, string> {
  return {
    welcome: `আসসালামু আলাইকুম। ঘুমপাড়া বেবি থেকে কল করছি। আপনার অর্ডার কনফার্ম করতে ১ চাপুন। বাতিল করতে ২ চাপুন।`,
    repeat: "2",
    sms: `ঘুমপাড়া বেবি: আপনার অর্ডার (${orderCode}) এর কনফার্মেশন কল পাচ্ছেন। কল ধরুন।`,
    menuMessage1:
      "আপনার অর্ডার সফলভাবে কনফার্ম হয়েছে। শীঘ্রই কুরিয়ারে পাঠানো হবে। পণ্য হাতে পেয়ে টাকা দিন। ধন্যবাদ।",
    sms1: `ঘুমপাড়া বেবি: আপনার অর্ডার কনফার্ম হয়েছে। ক্যাশ অন ডেলিভারি। হটলাইন: ${HOTLINE}`,
    menuMessage2:
      "আপনার অর্ডার বাতিল করা হয়েছে। আবার অর্ডার করতে চাইলে আমাদের ওয়েবসাইটে যান। ধন্যবাদ।",
  };
}

const CALL_BUTTONS = JSON.stringify([
  { id: "menuMessage1", key: "1", value: "Confirm Order" },
  { id: "menuMessage2", key: "2", value: "Cancel Order" },
]);

/**
 * Dispatch a confirmation call for an order (or a TEST call).
 * Body must be multipart/form-data per ManyDial docs — fetch derives the
 * boundary automatically from FormData.
 * Never throws — returns a Bengali-ready error on failure.
 */
export async function dispatchConfirmationCall(
  config: ManyDialConfig,
  input: {
    callPayload: string;
    phone: string;
    webhookUrl: string;
    perCallDuration?: string;
  }
): Promise<MdCallResult> {
  try {
    const form = new FormData();
    form.append("callPayload", input.callPayload);
    form.append("callerId", config.callerId);
    form.append("perCallDuration", input.perCallDuration ?? "2");
    form.append("messages", JSON.stringify(buildMessages(input.callPayload)));
    form.append("number", `+88${input.phone}`);
    form.append("buttons", CALL_BUTTONS);
    form.append("deliveryHook", input.webhookUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${MANYDIAL_BASE_URL}/call/dispatch`, {
        method: "POST",
        headers: { "x-api-key": config.apiKey },
        body: form,
        signal: controller.signal,
      });
      const text = (await res.text()).slice(0, 800);
      if (res.ok) {
        // 2xx = accepted; ManyDial reports flow results via the webhook
        let failed: { status?: string; message?: string } | null = null;
        try {
          failed = JSON.parse(text);
        } catch {
          /* non-JSON body — treat 2xx as success */
        }
        if (failed?.status === "failed" || failed?.status === "error") {
          return { ok: false, error: `ManyDial: ${failed.message ?? text.slice(0, 200)}` };
        }
        return { ok: true };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error: "ManyDial API key সঠিক নয়। পোর্টাল থেকে x-api-key মিলিয়ে নিন।",
        };
      }
      return { ok: false, error: `ManyDial সাড়া দেয়নি (${res.status})। ${text.slice(0, 150)}` };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, error: "ManyDial-এ সংযোগ করা যায়নি। আবার চেষ্টা করুন।" };
  }
}

/**
 * Caller ID request — one-time verification form for a dedicated number.
 * images are base64 data URLs from the admin form. Never throws.
 */
export async function requestCallerId(
  apiKey: string,
  form: Record<string, string>
): Promise<MdCallResult> {
  try {
    const body = new FormData();
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === "string" && v.length > 0) body.append(k, v);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${MANYDIAL_BASE_URL}/callerId`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body,
        signal: controller.signal,
      });
      const text = (await res.text()).slice(0, 800);
      if (res.ok) return { ok: true };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "API key সঠিক নয় — আগে সঠিক x-api-key দিন।" };
      }
      return { ok: false, error: `ManyDial (${res.status}): ${text.slice(0, 200)}` };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, error: "ManyDial-এ সংযোগ করা যায়নি। আবার চেষ্টা করুন।" };
  }
}
