/**
 * Pure (client-safe) Google Tag Manager helpers — NO server imports here.
 * Server-side config read/write lives in src/lib/gtm-config.ts
 */

export type GtmConfig = {
  containerId: string;
  enabled: boolean;
  events: GtmEvents;
};

export type GtmEventId = "viewItem" | "purchase";

export type GtmEvents = Record<GtmEventId, boolean>;

export const GTM_EVENT_IDS: GtmEventId[] = ["viewItem", "purchase"];

export const GTM_EVENT_META: Record<
  GtmEventId,
  { label: string; desc: string }
> = {
  viewItem: {
    label: "view_item — প্রোডাক্ট দেখা",
    desc: "ল্যান্ডিং পেজ লোড হলে প্রোডাক্ট তথ্য dataLayer-এ যাবে (SKU, নাম, দাম)।",
  },
  purchase: {
    label: "purchase — অর্ডার সম্পন্ন",
    desc: "অর্ডার সফল হলে dataLayer-এ purchase ইভেন্ট যাবে (SKU, দাম, অর্ডার ID)।",
  },
};

export const DEFAULT_GTM_EVENTS: GtmEvents = {
  viewItem: true,
  purchase: true,
};

export const DEFAULT_GTM_CONFIG: GtmConfig = {
  containerId: "",
  enabled: false,
  events: DEFAULT_GTM_EVENTS,
};

/**
 * Paste করা টেক্সট থেকে GTM Container ID ডিটেক্ট করে।
 * সাপোর্ট করে:
 *  ১) সরাসরি ID — "GTM-XXXXXXX"
 *  ২) স্ক্রিপ্ট কোড থেকে src="...GTM-XXXXXXX..."
 *  ৩) যেকোনো জায়গায় GTM- followed by alphanumeric chars
 */
export function extractGtmId(raw: string): string {
  if (!raw) return "";
  const input = String(raw);

  // ১) সরাসরি ID
  const direct = input.match(/GTM-[A-Z0-9]+/i);
  if (direct) return direct[0].toUpperCase();

  return "";
}

/** Container ID sanitize */
export function sanitizeContainerId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const match = raw.match(/GTM-[A-Z0-9]+/i);
  return match ? match[0].toUpperCase() : "";
}

/** ইভেন্ট sanitize — শুধু পরিচিত key, boolean মান */
export function sanitizeGtmEvents(raw: unknown): GtmEvents {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_GTM_EVENTS };
  for (const id of GTM_EVENT_IDS) {
    if (typeof src[id] === "boolean") out[id] = src[id] as boolean;
  }
  return out;
}

/** যেকোনো unknown ডেটাকে নিরাপদ GtmConfig-এ রূপান্তর */
export function sanitizeGtmConfig(raw: unknown): GtmConfig {
  const src = (raw ?? {}) as Record<string, unknown>;
  const containerId = sanitizeContainerId(src.containerId);
  return {
    containerId,
    enabled: containerId !== "" && src.enabled === true,
    events: sanitizeGtmEvents(src.events),
  };
}
