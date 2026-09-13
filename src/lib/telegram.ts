import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import {
  DEFAULT_TELEGRAM_CONFIG,
  sanitizeTelegramConfig,
  type TelegramConfig,
} from "@/lib/telegram-shared";
import { PRODUCT_COLORS, toBn } from "@/lib/landing-data";
import { R2_IMAGES_LIVE, siteImage } from "@/lib/site-images";

export const TELEGRAM_SETTING_KEY = "telegram_config";

/** Max product photos per alert (1 main + up to 3 extra). */
const MAX_PHOTOS = 4;

/** Read Telegram config from DB (safe defaults on any problem). */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const row = await db.setting.findUnique({
      where: { key: TELEGRAM_SETTING_KEY },
    });
    if (!row) return DEFAULT_TELEGRAM_CONFIG;
    return sanitizeTelegramConfig(JSON.parse(row.value)) ?? DEFAULT_TELEGRAM_CONFIG;
  } catch {
    return DEFAULT_TELEGRAM_CONFIG;
  }
}

/** Persist Telegram config (admin only). */
export async function saveTelegramConfig(config: TelegramConfig): Promise<void> {
  const sane =
    sanitizeTelegramConfig(config) ??
    (() => {
      throw new Error("invalid telegram config");
    })();
  await db.setting.upsert({
    where: { key: TELEGRAM_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: TELEGRAM_SETTING_KEY, value: JSON.stringify(sane) },
  });
}

export type TgOrder = {
  orderCode: string;
  name: string;
  phone: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  packageName: string;
  colors: string[];
  quantity: number;
  unitPrice: number;
  deliveryZoneLabel: string;
  deliveryCharge: number;
  totalPrice: number;
};

export type TgResult = { ok: true } | { ok: false; error: string };

function colorLabel(id: string): string {
  return PRODUCT_COLORS.find((c) => c.id === id)?.label ?? id;
}

/**
 * Load one product photo as bytes — from R2 when live, else local disk.
 * Returns null when unreadable (caller falls back to text-only message).
 */
async function loadPhotoBytes(id: string): Promise<Buffer | null> {
  if (!PRODUCT_COLORS.some((c) => c.id === id)) return null;
  const relPath = `/images/swaddle-${id}.jpg`;
  if (R2_IMAGES_LIVE) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(siteImage(relPath), { signal: controller.signal });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  }
  try {
    return await readFile(path.join(process.cwd(), "public", relPath.slice(1)));
  } catch {
    return null;
  }
}

/** "গোলাপি ×২, লাল ×১" + total piece count. */
function colorsSummary(colors: string[]): string {
  const counts = new Map<string, number>();
  for (const c of colors) counts.set(c, (counts.get(c) ?? 0) + 1);
  const parts = [...counts.entries()].map(([id, n]) =>
    n > 1 ? `${colorLabel(id)} ×${toBn(n)}` : colorLabel(id)
  );
  return `${parts.join(", ")} (${toBn(colors.length)}টি)`;
}

function locationLine(o: TgOrder): string {
  const bits = [o.address, o.upazila, o.district, o.division].filter(
    (s) => s && s.trim().length > 0
  );
  return bits.join(", ");
}

/** Full order details caption (plain text — fits photo-caption limit). */
export function buildOrderCaption(o: TgOrder, sample = false): string {
  return [
    sample ? "🧪 টেস্ট অ্যালার্ট — ঘুমপাড়া বেবি" : "🧸 নতুন অর্ডার!",
    `🧾 কোড: ${o.orderCode}`,
    "",
    `👤 নাম: ${o.name}`,
    `📞 ফোন: ${o.phone}`,
    `📍 ঠিকানা: ${locationLine(o)}`,
    "",
    `📦 প্যাকেজ: ${o.packageName}`,
    `🎨 কালার: ${colorsSummary(o.colors)}`,
    `💰 প্রতি পিস: ৳${toBn(o.unitPrice)}`,
    o.deliveryCharge > 0
      ? `🚚 ডেলিভারি: ${o.deliveryZoneLabel} (৳${toBn(o.deliveryCharge)})`
      : `🚚 ডেলিভারি: ${o.deliveryZoneLabel || "—"}`,
    `💵 সর্বমোট: ৳${toBn(o.totalPrice)} (ক্যাশ অন ডেলিভারি)`,
  ].join("\n");
}

/** Sample order used by the admin "Test" button. */
export const SAMPLE_TG_ORDER: TgOrder = {
  orderCode: "GP-000000-TEST",
  name: "টেস্ট কাস্টমার",
  phone: "01700000000",
  address: "বাসা ১, রোড ২, মিরপুর",
  division: "ঢাকা",
  district: "ঢাকা",
  upazila: "মিরপুর",
  packageName: "কম্বো (২টি)",
  colors: ["pink", "blue"],
  quantity: 2,
  unitPrice: 500,
  deliveryZoneLabel: "ঢাকার ভিতরে",
  deliveryCharge: 60,
  totalPrice: 1060,
};

async function tgFetch(
  token: string,
  method: string,
  body: FormData | string,
  isJson: boolean,
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: isJson ? { "Content-Type": "application/json" } : undefined,
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

async function tgGet(
  token: string,
  method: string,
  params: Record<string, string>,
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}?${qs}`, {
      signal: controller.signal,
    });
    const text = (await res.text()).slice(0, 500);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export type BotInfo = { id: string; username: string; name: string };

/**
 * Validate a bot token via getMe.
 * Never throws — returns a Bengali-ready error on failure.
 */
export async function getBotInfo(token: string): Promise<
  | { ok: true; bot: BotInfo }
  | { ok: false; error: string }
> {
  try {
    const r = await tgGet(token, "getMe", {});
    const result = (r.json as { ok?: boolean; result?: { id?: number; username?: string; first_name?: string } } | null);
    if (r.ok && result?.ok && result.result?.username && result.result?.id) {
      return {
        ok: true,
        bot: {
          id: String(result.result.id),
          username: result.result.username,
          name: result.result.first_name ?? result.result.username,
        },
      };
    }
    if (r.status === 401 || r.status === 404) {
      return { ok: false, error: "Bot Token সঠিক নয়। @BotFather থেকে নতুন token নিয়ে আবার চেষ্টা করুন।" };
    }
    return { ok: false, error: `Telegram যাচাই ব্যর্থ (${r.status})। আবার চেষ্টা করুন।` };
  } catch {
    return { ok: false, error: "Telegram-এ সংযোগ করা যায়নি। ইন্টারনেট/সার্ভার দেখে আবার চেষ্টা করুন।" };
  }
}

/**
 * Is this "chat" actually the bot itself? Bots can never message
 * themselves — the classic cause of
 * "Forbidden: the bot can't send messages to the bot".
 * (Usually happens when the token's leading number is pasted as Chat ID.)
 */
export function isSelfChat(chatId: string, bot: BotInfo): boolean {
  const norm = chatId.trim().replace(/^@/, "").toLowerCase();
  return norm === bot.username.toLowerCase() || norm === bot.id;
}

/**
 * Translate raw Telegram API errors into actionable Bengali.
 * Falls back to the trimmed original when nothing matches.
 */
export function friendlyTelegramError(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("bot can't send messages to the bot")) {
    return "Chat ID-টা bot-এর নিজের ID মনে হচ্ছে (bot নিজেকে মেসেজ পাঠাতে পারে না)। Token-এর সামনের সংখ্যা Chat ID নয় — @userinfobot থেকে আপনার নিজের ID নিন (গাইডের ধাপ ২)।";
  }
  if (t.includes("bot was blocked by the user")) {
    return "bot-কে Block করা আছে বা /start দেওয়া হয়নি — Telegram-এ bot-টাকে খুঁজে /start চাপুন, তারপর আবার চেষ্টা করুন।";
  }
  if (t.includes("chat not found")) {
    return "Chat ID পাওয়া যায়নি — ID-টা ঠিক আছে কিনা মিলিয়ে নিন (গ্রুপের হলে মাইনাসসহ পুরোটা)।";
  }
  if (t.includes("not enough rights") || t.includes("need administrator")) {
    return "bot-এর পোস্ট করার অনুমতি নেই — গ্রুপ/channel-এ bot-কে admin বানান (Post Messages ON), তারপর আবার চেষ্টা করুন।";
  }
  return raw.slice(0, 300);
}

/** Confirm the bot can actually reach the chat (catches wrong chat IDs... */
export async function checkChat(
  token: string,
  chatId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await tgGet(token, "getChat", { chat_id: chatId });
    const result = (r.json as { ok?: boolean } | null);
    if (r.ok && result?.ok) return { ok: true };
    return {
      ok: false,
      error:
        "Chat ID-তে মেসেজ পাঠানো যাচ্ছে না। bot-কে ওই chat/group-এ add করে (group হলে admin বানিয়ে) আবার চেষ্টা করুন।",
    };
  } catch {
    return { ok: false, error: "Telegram-এ সংযোগ করা যায়নি। আবার চেষ্টা করুন।" };
  }
}

/**
 * Post a new-order alert: main product photo with full-details caption,
 * then remaining color photos (no caption). Falls back to text-only if
 * no photo file is readable.
 * Never throws — callers must not fail the order because of Telegram.
 */
export async function sendNewOrderAlert(
  config: TelegramConfig,
  order: TgOrder,
  sample = false
): Promise<TgResult> {
  try {
    const caption = buildOrderCaption(order, sample);
    const uniqueColors = [...new Set(order.colors)].slice(0, MAX_PHOTOS);

    const photos: Buffer[] = [];
    for (const id of uniqueColors) {
      const bytes = await loadPhotoBytes(id);
      if (bytes) photos.push(bytes);
      if (photos.length >= MAX_PHOTOS) break;
    }

    if (photos.length === 0) {
      const r = await tgFetch(
        config.botToken,
        "sendMessage",
        JSON.stringify({ chat_id: config.chatId, text: caption }),
        true
      );
      if (!r.ok) return { ok: false, error: `telegram ${r.status}: ${r.text}` };
      return { ok: true };
    }

    // 1) Main photo + full caption
    const main = new FormData();
    main.append("chat_id", config.chatId);
    main.append("caption", caption);
    main.append("photo", new Blob([new Uint8Array(photos[0])]), "photo.jpg");
    const m = await tgFetch(config.botToken, "sendPhoto", main, false);
    if (!m.ok) return { ok: false, error: `telegram ${m.status}: ${m.text}` };

    // 2) Remaining color photos, one album (no caption needed)
    if (photos.length > 1) {
      const album = new FormData();
      const media = photos.slice(1).map((_, i) => ({
        type: "photo",
        media: `attach://extra${i}`,
      }));
      album.append("chat_id", config.chatId);
      album.append("media", JSON.stringify(media));
      photos.slice(1).forEach((buf, i) => {
        album.append(`extra${i}`, new Blob([new Uint8Array(buf)]), `extra${i}.jpg`);
      });
      const a = await tgFetch(config.botToken, "sendMediaGroup", album, false);
      if (!a.ok) return { ok: false, error: `telegram ${a.status}: ${a.text}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
