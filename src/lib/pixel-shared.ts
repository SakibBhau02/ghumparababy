/**
 * Pure (client-safe) Meta Pixel helpers — NO server/database imports here.
 * Server-side config read/write lives in src/lib/pixel-config.ts
 *
 * Admin panel থেকে pixel সেটআপ ও ইভেন্ট ম্যানেজমেন্ট করার জন্য
 * প্রয়োজনীয় সব টাইপ, ডিফল্ট ও পার্সিং লজিক এখানে।
 */

export type PixelEventId =
  | "pageView"
  | "viewContent"
  | "initiateCheckout"
  | "purchase"
  | "contact";

export type PixelEvents = Record<PixelEventId, boolean>;

export type PixelConfig = {
  pixelId: string;
  enabled: boolean;
  events: PixelEvents;
  /** Meta Conversions API access token (server-side Purchase). Empty = browser pixel only. */
  capiToken: string;
  /** Optional Meta Test Events code — events go to Test Events tab, not live. Clear for live. */
  testEventCode: string;
};

export const PIXEL_EVENT_IDS: PixelEventId[] = [
  "pageView",
  "viewContent",
  "initiateCheckout",
  "purchase",
  "contact",
];

/** Admin UI-তে দেখানোর জন্য প্রতিটি ইভেন্টের বাংলা নাম ও বর্ণনা */
export const PIXEL_EVENT_META: Record<
  PixelEventId,
  { label: string; desc: string; fbEvent: string }
> = {
  pageView: {
    label: "PageView — পেজ ভিজিট",
    desc: "যেকোনো ভিজিটর ল্যান্ডিং পেজে এলেই ফায়ার হয়। অ্যাড রান করার জন্য সবচেয়ে জরুরি।",
    fbEvent: "PageView",
  },
  viewContent: {
    label: "ViewContent — প্রোডাক্ট দেখা",
    desc: "প্রোডাক্ট পেজ লোড হলে ফায়ার হয়। রিটার্গেটিং অডিয়েন্স (যারা দেখেছে কিন্তু কেনেনি) তৈরিতে কাজে লাগে।",
    fbEvent: "ViewContent",
  },
  initiateCheckout: {
    label: "InitiateCheckout — অর্ডার শুরু",
    desc: "কেউ অর্ডার ফর্মে প্রথম ইন্টারঅ্যাকশন করলে (প্যাকেজ/কালার সিলেক্ট, নাম-নম্বর লেখা) ফায়ার হয়।",
    fbEvent: "InitiateCheckout",
  },
  purchase: {
    label: "Purchase — অর্ডার সম্পন্ন",
    desc: "অর্ডার সফলভাবে জমা হলে ফায়ার হয় (টাকার পরিমাণ ও অর্ডার কোডসহ)। ROI/ROAS হিসাবের জন্য অপরিহার্য।",
    fbEvent: "Purchase",
  },
  contact: {
    label: "Contact — কল / WhatsApp",
    desc: "কেউ হেল্পলাইনে কল বাটন বা ভাসমান WhatsApp বাটনে ক্লিক করলে ফায়ার হয়।",
    fbEvent: "Contact",
  },
};

export const DEFAULT_PIXEL_EVENTS: PixelEvents = {
  pageView: true,
  viewContent: true,
  initiateCheckout: true,
  purchase: true,
  contact: true,
};

export const DEFAULT_PIXEL_CONFIG: PixelConfig = {
  pixelId: "",
  enabled: false,
  events: DEFAULT_PIXEL_EVENTS,
  capiToken: "",
  testEventCode: "",
};

/**
 * ইউজারের পেস্ট করা টেক্সট থেকে Pixel ID বের করে।
 * সাপোর্ট করে:
 *  ১) সরাসরি ID — "1234567890123456"
 *  ২) Meta এর পুরো pixel code — fbq('init', '1234567890123456')
 *  ৩) কোডের ভিতরে quote-এ ঘেরা যেকোনো ১৫-১৬ ডিজিটের সংখ্যা
 * না পেলে খালি স্ট্রিং দেয়।
 */
export function extractPixelId(raw: string): string {
  if (!raw) return "";
  const input = String(raw);

  // ১) সরাসরি ID (স্পেস/ড্যাশ বাদ দিয়ে)
  const stripped = input.replace(/[\s-]/g, "");
  if (/^\d{15,16}$/.test(stripped)) return stripped;

  // ২) fbq('init', 'ID') — single/double quote
  const initMatch = input.match(
    /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/i
  );
  if (initMatch) return initMatch[1];

  // ৩) init ছাড়া অন্য ভ্যারিয়েন্ট (যেমন partner কোড): quote-এ ঘেরা ১৫-১৬ ডিজিট
  const quoted = input.match(/['"](\d{15,16})['"]/);
  if (quoted) return quoted[1];

  return "";
}

/** ইভেন্ট অবজেক্ট sanitize — শুধু পরিচিত key-গুলো, boolean মান */
export function sanitizePixelEvents(raw: unknown): PixelEvents {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PIXEL_EVENTS };
  for (const id of PIXEL_EVENT_IDS) {
    if (typeof src[id] === "boolean") out[id] = src[id] as boolean;
  }
  return out;
}

/** যেকোনো unknown ডেটাকে নিরাপদ PixelConfig-এ রূপান্তর (DB/API/client সবখানে ব্যবহৃত) */
export function sanitizePixelConfig(raw: unknown): PixelConfig {
  const src = (raw ?? {}) as Record<string, unknown>;
  const pixelId =
    typeof src.pixelId === "string" && /^\d{15,16}$/.test(src.pixelId.trim())
      ? src.pixelId.trim()
      : "";
  const capped = (v: unknown, max: number): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  return {
    pixelId,
    enabled: pixelId !== "" && src.enabled === true,
    events: sanitizePixelEvents(src.events),
    capiToken: capped(src.capiToken, 500),
    testEventCode: capped(src.testEventCode, 64),
  };
}

/** Server-side Purchase পাঠানো যাবে? (pixel on + token present) */
export function isCapiReady(config: PixelConfig): boolean {
  return config.enabled && config.pixelId !== "" && config.capiToken !== "";
}
