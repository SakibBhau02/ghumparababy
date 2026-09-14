/**
 * Pure (client-safe) customer segmentation + COD success metrics.
 * Segments are ALWAYS computed on the fly from order aggregates —
 * never stored — so they stay correct as orders change.
 *
 * Lifecycle (simplified RFM, tuned for a small BD COD store):
 *   blacklist  → admin-flagged, overrides everything
 *   inactive   → no order in 90+ days
 *   at_risk    → no order in 45+ days
 *   loyal      → 3+ orders AND ৳5000+ lifetime
 *   regular    → 2+ orders
 *   new        → 1 order
 */

export type SegmentId =
  | "blacklist"
  | "inactive"
  | "at_risk"
  | "loyal"
  | "regular"
  | "new";

export const SEGMENTS: Record<
  SegmentId,
  { label: string; badge: string; order: number }
> = {
  blacklist: {
    label: "কালো তালিকা",
    badge: "bg-red-100 text-red-800 border-red-300",
    order: 0,
  },
  loyal: {
    label: "লয়্যাল",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    order: 1,
  },
  at_risk: {
    label: "অ্যাট-রিস্ক",
    badge: "bg-orange-100 text-orange-800 border-orange-300",
    order: 2,
  },
  inactive: {
    label: "ইনঅ্যাক্টিভ",
    badge: "bg-zinc-200 text-zinc-700 border-zinc-300",
    order: 3,
  },
  regular: {
    label: "রেগুলার",
    badge: "bg-sky-100 text-sky-800 border-sky-300",
    order: 4,
  },
  new: {
    label: "নতুন",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    order: 5,
  },
};

/** Days thresholds (COD store: shorter than Western e-comm benchmarks). */
export const AT_RISK_DAYS = 45;
export const INACTIVE_DAYS = 90;
/** Loyal bar: 3+ orders AND ৳5000+ lifetime spend. */
export const LOYAL_MIN_ORDERS = 3;
export const LOYAL_MIN_SPENT = 5000;

/** Preset admin tags (custom ones can be typed too). */
export const PRESET_TAGS = ["VIP", "গিফট-বায়ার", "হোলসেল", "সমস্যা-কাস্টমার"];

export type SegmentInput = {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | Date;
  blacklisted?: boolean;
};

function daysSince(d: string | Date, now: Date): number {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

/** Compute the lifecycle segment for one customer. */
export function segmentOf(c: SegmentInput, now = new Date()): SegmentId {
  if (c.blacklisted) return "blacklist";
  const days = daysSince(c.lastOrderAt, now);
  if (days >= INACTIVE_DAYS) return "inactive";
  if (days >= AT_RISK_DAYS) return "at_risk";
  if (c.orderCount >= LOYAL_MIN_ORDERS && c.totalSpent >= LOYAL_MIN_SPENT) {
    return "loyal";
  }
  if (c.orderCount >= 2) return "regular";
  return "new";
}

export type CodStats = {
  delivered: number;
  cancelled: number;
  pending: number;
  /** Delivered / (delivered + cancelled), null when nothing finished yet. */
  rate: number | null;
};

/** COD delivery success from a customer's orders. */
export function codStats(orders: { status: string }[]): CodStats {
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const pending = orders.length - delivered - cancelled;
  const done = delivered + cancelled;
  return {
    delivered,
    cancelled,
    pending,
    rate: done === 0 ? null : Math.round((delivered / done) * 100),
  };
}

/** Parse the tags JSON column (falls back to empty list). */
export function parseTags(raw: string | undefined | null): string[] {
  try {
    const arr = JSON.parse(raw ?? "[]") as unknown;
    if (Array.isArray(arr)) {
      return arr.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    }
  } catch {
    // fall through
  }
  return [];
}
