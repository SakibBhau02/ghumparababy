/**
 * Pure (client-safe) ManyDial call-automation config — NO server imports here.
 * Server-side read/write + dispatch live in src/lib/manydial.ts.
 *
 * Setup (admin panel): paste x-api-key + approved caller ID, enable
 * auto-call. Every new order then gets a Bengali voice call — press 1 to
 * confirm, 2 to cancel; the webhook updates the order status automatically.
 */

export type ManyDialConfig = {
  enabled: boolean;
  apiKey: string;
  /** Approved caller ID (e.g. +8809600000000) — calls go out from this. */
  callerId: string;
  /** Auto-dispatch a confirmation call on every new order. */
  autoCall: boolean;
  /** Shared secret appended to the webhook URL (?secret=...) for verification. */
  webhookSecret: string;
};

export const DEFAULT_MANYDIAL_CONFIG: ManyDialConfig = {
  enabled: false,
  apiKey: "",
  callerId: "",
  autoCall: true,
  webhookSecret: "",
};

const MAX_LEN: Record<
  keyof Omit<ManyDialConfig, "autoCall" | "enabled">,
  number
> = {
  apiKey: 200,
  callerId: 24,
  webhookSecret: 64,
};

/** Sanitize anything coming from DB/admin into a valid ManyDialConfig. */
export function sanitizeManyDialConfig(input: unknown): ManyDialConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const str = (k: keyof typeof MAX_LEN): string => {
    const v = rec[k];
    if (typeof v !== "string") return "";
    return v.trim().slice(0, MAX_LEN[k]);
  };
  return {
    enabled: rec.enabled === true,
    apiKey: str("apiKey"),
    callerId: str("callerId"),
    autoCall: rec.autoCall !== false,
    webhookSecret: str("webhookSecret"),
  };
}

/** Ready to dispatch calls (enabled + key + caller ID present). */
export function isManyDialReady(config: ManyDialConfig): boolean {
  return (
    config.enabled &&
    config.apiKey.length > 0 &&
    config.callerId.length > 0
  );
}
