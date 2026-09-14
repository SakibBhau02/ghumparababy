/**
 * Pure (client-safe) fraud checker types & helpers.
 * Server-side courier API calls live in src/lib/courier-fraud.ts
 */

export type CourierId = "steadfast" | "pathao" | "redx" | "paperfly" | "carrybee";

/** A merchant-submitted complaint against a phone number (Steadfast only). */
export type FraudComplaint = {
  name: string | null;
  phone: string | null;
  details: string | null;
  image: string | null;
  consignmentId: string | null;
  createdAt: string | null;
};

export type CourierFraudResult = {
  delivered: number;
  cancelled: number;
  total: number;
  successRatio: number;
  // --- Native fraud signals (each courier exposes risk differently) ---
  /** Steadfast: full complaint list */
  frauds?: FraudComplaint[];
  /** Steadfast: number of complaints */
  fraudReportCount?: number;
  /** Pathao: qualitative rating, e.g. "excellent_customer" / "fraud_customer" */
  customerRating?: string | null;
  /** Pathao: coarse risk derived from customerRating */
  pathaoRisk?: "low" | "medium" | "high" | null;
  /** Pathao: false when Pathao exposes rating only (no numeric counts) */
  countsAvailable?: boolean;
  /** RedX: RedX's own tier label, e.g. "Normal Customer" */
  customerSegment?: string | null;
  /** Paperfly Smart Check V2 label, e.g. "Excellent" */
  label?: string | null;
  color?: string | null;
  icon?: string | null;
  note?: string | null;
  /** Paperfly: partial-delivery count */
  partial?: number;
  /** Paperfly: return count */
  returned?: number;
  /** Carrybee: Carrybee's own complaint counter */
  fraudCount?: number;
};

export type FraudSource = "direct" | "fraudbd";

export type FraudCheckResult = {
  phone: string;
  couriers: Partial<Record<CourierId, CourierFraudResult>>;
  aggregated: {
    delivered: number;
    cancelled: number;
    total: number;
    successRatio: number;
  };
  checkedAt: string;
  /** Per-courier failure reason (Bengali-ready). Present when a courier failed. */
  errors?: Partial<Record<CourierId, string>>;
  /** Where each courier's data came from (merchant login vs FraudBD API). */
  sources?: Partial<Record<CourierId, FraudSource>>;
};

export type FraudConfig = {
  enabled: boolean;
  credentials: Partial<Record<CourierId, { user: string; password: string }>>;
  autoCheck: boolean;
  /** FraudBD (third-party aggregator) API key — fallback when merchant login missing/fails. */
  fraudbdApiKey: string;
  /** Use FraudBD for couriers that have no merchant credentials or failed directly. */
  fraudbdFallback: boolean;
  /** Hit FraudBD sandbox endpoints (for testing with the sandbox key). */
  fraudbdSandbox: boolean;
};

export const COURIER_META: Record<CourierId, { label: string; color: string; requires: string }> = {
  steadfast: {
    label: "Steadfast",
    color: "bg-red-100 text-red-700 border-red-200",
    requires: "Email + Password",
  },
  pathao: {
    label: "Pathao",
    color: "bg-green-100 text-green-700 border-green-200",
    requires: "Email + Password",
  },
  redx: {
    label: "RedX",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    requires: "ফোন (01…) + Password",
  },
  paperfly: {
    label: "Paperfly",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    requires: "Username + Password",
  },
  carrybee: {
    label: "Carrybee",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    requires: "ফোন (01…) + Password",
  },
};

export const ALL_COURIER_IDS: CourierId[] = ["steadfast", "pathao", "redx", "paperfly", "carrybee"];

export const DEFAULT_FRAUD_CONFIG: FraudConfig = {
  enabled: false,
  credentials: {},
  autoCheck: false,
  fraudbdApiKey: "",
  fraudbdFallback: false,
  fraudbdSandbox: false,
};

/** BD phone regex: 01[3-9]XXXXXXXX */
const BD_PHONE_RE = /^01[3-9]\d{8}$/;

export function isValidBdPhone(phone: string): boolean {
  return BD_PHONE_RE.test(phone);
}

/** Normalize 880/+880/space-dash variants to 01XXXXXXXXX ("" when invalid). */
export function normalizeBdPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const local = digits.startsWith("880") ? `0${digits.slice(3)}` : digits;
  return BD_PHONE_RE.test(local) ? local : "";
}

/** Fraud risk level based on aggregated success ratio */
export function riskLevel(ratio: number, total: number): "low" | "medium" | "high" | "none" {
  if (total === 0) return "none";
  if (ratio >= 80) return "low";
  if (ratio >= 50) return "medium";
  return "high";
}

export const RISK_META: Record<string, { label: string; badge: string; emoji: string }> = {
  low: { label: "নিরাপদ", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", emoji: "✅" },
  medium: { label: "সতর্ক", badge: "bg-amber-100 text-amber-700 border-amber-200", emoji: "⚠️" },
  high: { label: "ঝুঁকিপূর্ণ", badge: "bg-red-100 text-red-700 border-red-200", emoji: "🚨" },
  none: { label: "ডেটা নেই", badge: "bg-gray-100 text-gray-600 border-gray-200", emoji: "❓" },
};

/** Pathao's qualitative rating → coarse risk (Pathao's primary fraud signal now). */
export function mapPathaoRiskLevel(rating: string | null | undefined): "low" | "medium" | "high" | null {
  if (!rating) return null;
  switch (rating.toLowerCase()) {
    case "excellent_customer":
    case "good_customer":
      return "low";
    case "regular_customer":
    case "moderate_customer":
    case "new_customer":
      return "medium";
    case "risky_customer":
    case "fraud_customer":
      return "high";
    default:
      return null;
  }
}

export const PATHAO_RATING_LABEL: Record<string, string> = {
  excellent_customer: "চমৎকার কাস্টমার",
  good_customer: "ভালো কাস্টমার",
  regular_customer: "নিয়মিত কাস্টমার",
  moderate_customer: "মাঝারি কাস্টমার",
  new_customer: "নতুন কাস্টমার",
  risky_customer: "ঝুঁকিপূর্ণ কাস্টমার",
  fraud_customer: "ফ্রড কাস্টমার",
};

/** Sanitize fraud config from DB/admin input */
export function sanitizeFraudConfig(raw: unknown): FraudConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const credentials: FraudConfig["credentials"] = {};
  if (rec.credentials && typeof rec.credentials === "object") {
    const credRec = rec.credentials as Record<string, unknown>;
    for (const cid of ALL_COURIER_IDS) {
      const entry = credRec[cid];
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const user = typeof e.user === "string" ? e.user.trim().slice(0, 128) : "";
        const password = typeof e.password === "string" ? e.password.trim().slice(0, 256) : "";
        if (user && password) {
          credentials[cid] = { user, password };
        }
      }
    }
  }
  return {
    enabled: rec.enabled === true,
    credentials,
    autoCheck: rec.autoCheck === true,
    fraudbdApiKey: typeof rec.fraudbdApiKey === "string" ? rec.fraudbdApiKey.trim().slice(0, 256) : "",
    fraudbdFallback: rec.fraudbdFallback === true,
    fraudbdSandbox: rec.fraudbdSandbox === true,
  };
}

/** True when at least one data source is configured (merchant login or FraudBD).
 *  `enabled` only gates auto-check; manual check works whenever creds/key exist. */
export function isFraudReady(config: FraudConfig): boolean {
  if (Object.keys(config.credentials).length > 0) return true;
  return config.fraudbdApiKey.length > 0;
}
