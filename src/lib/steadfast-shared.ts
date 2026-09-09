/**
 * Pure (client-safe) Steadfast courier config — NO server imports here.
 * Server-side read/write + API calls live in src/lib/steadfast.ts.
 *
 * Setup (admin panel, one time): paste the Api-Key + Secret-Key from the
 * Steadfast merchant panel (steadfast.com.bd/user/api), press "Check" —
 * the server validates via get_balance and saves.
 * From then on each order gets a one-click "Steadfast-এ পাঠান" button
 * that creates the consignment and stores its ID + tracking code.
 */

export type SteadfastConfig = {
  enabled: boolean;
  apiKey: string;
  secretKey: string;
};

export const DEFAULT_STEADFAST_CONFIG: SteadfastConfig = {
  enabled: false,
  apiKey: "",
  secretKey: "",
};

const MAX_LEN: Record<keyof Omit<SteadfastConfig, "enabled">, number> = {
  apiKey: 128,
  secretKey: 128,
};

/** Sanitize anything coming from DB/admin into a valid SteadfastConfig. */
export function sanitizeSteadfastConfig(input: unknown): SteadfastConfig | null {
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
    secretKey: str("secretKey"),
  };
}

/** Ready to actually call the API (enabled + both keys present). */
export function isSteadfastReady(config: SteadfastConfig): boolean {
  return (
    config.enabled && config.apiKey.length > 0 && config.secretKey.length > 0
  );
}
