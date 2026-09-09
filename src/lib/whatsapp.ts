import { db } from "@/lib/db";
import {
  DEFAULT_WHATSAPP_CONFIG,
  sanitizeWhatsappConfig,
  type WhatsappConfig,
} from "@/lib/whatsapp-shared";

export const WHATSAPP_SETTING_KEY = "whatsapp_config";

/** Read WhatsApp config from DB (safe defaults on any problem). */
export async function getWhatsappConfig(): Promise<WhatsappConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: WHATSAPP_SETTING_KEY },
    });
    if (!row) return DEFAULT_WHATSAPP_CONFIG;
    return sanitizeWhatsappConfig(JSON.parse(row.value)) ?? DEFAULT_WHATSAPP_CONFIG;
  } catch {
    return DEFAULT_WHATSAPP_CONFIG;
  }
}

/** Persist WhatsApp config (admin only). */
export async function saveWhatsappConfig(config: WhatsappConfig): Promise<void> {
  const sane =
    sanitizeWhatsappConfig(config) ??
    (() => {
      throw new Error("invalid whatsapp config");
    })();
  await db.setting.upsert({
    where: { key: WHATSAPP_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: WHATSAPP_SETTING_KEY, value: JSON.stringify(sane) },
  });
}

export type WaOrder = {
  name: string;
  phone: string;
  orderCode: string;
  packageName: string;
  quantity: number;
  totalPrice: number;
};

export type WaSendResult = { ok: true } | { ok: false; error: string };

/**
 * Send the order-confirmation template via Meta WhatsApp Cloud API.
 * Never throws — callers must not fail the order update because of WA.
 */
export async function sendOrderConfirmation(
  config: WhatsappConfig,
  order: WaOrder
): Promise<WaSendResult> {
  try {
    const to = `88${order.phone}`;
    if (!/^8801[3-9]\d{8}$/.test(to)) {
      return { ok: false, error: "invalid phone" };
    }
    const params = [
      order.name,
      order.orderCode,
      order.packageName,
      String(order.quantity),
      String(order.totalPrice),
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(
        `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: config.templateName,
              language: { code: config.languageCode || "bn" },
              components: [
                {
                  type: "body",
                  parameters: params.map((text) => ({ type: "text", text })),
                },
              ],
            },
          }),
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
