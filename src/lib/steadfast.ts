import { db } from "@/lib/db";
import {
  DEFAULT_STEADFAST_CONFIG,
  sanitizeSteadfastConfig,
  type SteadfastConfig,
} from "@/lib/steadfast-shared";

export const STEADFAST_SETTING_KEY = "steadfast_config";
export const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";

/** Read Steadfast config from DB (safe defaults on any problem). */
export async function getSteadfastConfig(): Promise<SteadfastConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: STEADFAST_SETTING_KEY },
    });
    if (!row) return DEFAULT_STEADFAST_CONFIG;
    return sanitizeSteadfastConfig(JSON.parse(row.value)) ?? DEFAULT_STEADFAST_CONFIG;
  } catch {
    return DEFAULT_STEADFAST_CONFIG;
  }
}

/** Persist Steadfast config (admin only). */
export async function saveSteadfastConfig(config: SteadfastConfig): Promise<void> {
  const sane =
    sanitizeSteadfastConfig(config) ??
    (() => {
      throw new Error("invalid steadfast config");
    })();
  await db.setting.upsert({
    where: { key: STEADFAST_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: STEADFAST_SETTING_KEY, value: JSON.stringify(sane) },
  });
}

export type SfOrderInput = {
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  note: string;
  itemDescription: string;
};

export type SfResult =
  | { ok: true; consignmentId: string; trackingCode: string }
  | { ok: false; error: string };

function headers(config: SteadfastConfig): Record<string, string> {
  return {
    "Api-Key": config.apiKey,
    "Secret-Key": config.secretKey,
    "Content-Type": "application/json",
  };
}

async function sfFetch(
  config: SteadfastConfig,
  path: string,
  init?: RequestInit,
  timeoutMs = 20000
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${STEADFAST_BASE_URL}${path}`, {
      ...init,
      headers: { ...headers(config), ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    return { status: res.status, text: (await res.text()).slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate API keys via get_balance (free, creates nothing).
 * Never throws — returns a Bengali-ready error on failure.
 */
export async function checkSteadfastKeys(
  config: SteadfastConfig
): Promise<{ ok: true; balance: string } | { ok: false; error: string }> {
  try {
    const r = await sfFetch(config, "/get_balance");
    let json: { status?: number; current_balance?: number | string } | null = null;
    try {
      json = JSON.parse(r.text);
    } catch {
      /* non-JSON body */
    }
    if (r.status === 200 && json && json.status === 200) {
      return { ok: true, balance: String(json.current_balance ?? "—") };
    }
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        error: "Api-Key বা Secret-Key সঠিক নয়। Steadfast প্যানেল (steadfast.com.bd/user/api) থেকে key নিয়ে আবার চেষ্টা করুন।",
      };
    }
    return { ok: false, error: `Steadfast যাচাই ব্যর্থ (${r.status})। আবার চেষ্টা করুন।` };
  } catch {
    return { ok: false, error: "Steadfast-এ সংযোগ করা যায়নি। ইন্টারনেট/সার্ভার দেখে আবার চেষ্টা করুন।" };
  }
}

/**
 * Create a consignment for an order.
 * Never throws — callers show result.error to the admin in Bengali-friendly form.
 */
export async function createConsignment(
  config: SteadfastConfig,
  input: SfOrderInput
): Promise<SfResult> {
  try {
    const r = await sfFetch(config, "/create_order", {
      method: "POST",
      body: JSON.stringify({
        invoice: input.invoice,
        recipient_name: input.recipientName.slice(0, 100),
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress.slice(0, 250),
        cod_amount: Math.max(0, Math.round(input.codAmount)),
        note: input.note.slice(0, 480),
        item_description: input.itemDescription.slice(0, 250),
      }),
    });
    let json: {
      status?: number;
      message?: string;
      consignment?: { consignment_id?: number | string; tracking_code?: string };
      errors?: unknown;
    } | null = null;
    try {
      json = JSON.parse(r.text);
    } catch {
      return { ok: false, error: `Steadfast সাড়া দেয়নি (${r.status})। আবার চেষ্টা করুন।` };
    }
    const cid = json?.consignment?.consignment_id;
    if (r.status === 200 && json?.status === 200 && cid !== undefined && cid !== null) {
      return {
        ok: true,
        consignmentId: String(cid),
        trackingCode: json.consignment?.tracking_code ?? "",
      };
    }
    const msg =
      (typeof json?.message === "string" && json.message) ||
      `Steadfast এরর (${r.status})`;
    // Duplicate invoice = already created → tell admin instead of double-booking
    if (/already|duplicate|exists/i.test(msg)) {
      return { ok: false, error: `এই invoice-তে আগেই consignment আছে (${msg})।` };
    }
    return { ok: false, error: msg.slice(0, 300) };
  } catch {
    return { ok: false, error: "Steadfast-এ সংযোগ করা যায়নি। আবার চেষ্টা করুন।" };
  }
}
