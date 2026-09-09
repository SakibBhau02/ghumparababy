/**
 * Pure (client-safe) delivery helpers — NO server/database imports here.
 * Server-side config read/write lives in src/lib/delivery.ts
 */

export type DeliveryZone = { id: string; label: string; charge: number; note: string };
export type DeliveryConfig = { zones: DeliveryZone[] };

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = {
  zones: [
    { id: "inside_dhaka", label: "ঢাকার ভিতরে", charge: 60, note: "" },
    { id: "outside_dhaka", label: "ঢাকার বাইরে", charge: 120, note: "" },
  ],
};

/** Max length of the admin's custom note per zone. */
export const ZONE_NOTE_MAX = 140;

/** Charge for a zone (0 when unknown / free). */
export function zoneCharge(
  config: DeliveryConfig,
  zoneId: string | undefined | null
): number {
  if (!zoneId) return 0;
  const z = config.zones.find((x) => x.id === zoneId);
  return z ? z.charge : 0;
}

/** True when every zone charge is 0 → "ফ্রি ডেলিভারি" copy everywhere. */
export function isAllFree(config: DeliveryConfig): boolean {
  return config.zones.every((z) => z.charge === 0);
}

/** Landing badge text: "ফ্রি ডেলিভারি" or neutral "সারা দেশে ডেলিভারি". */
export function deliveryBadgeText(config: DeliveryConfig): string {
  return isAllFree(config) ? "ফ্রি ডেলিভারি" : "সারা দেশে ডেলিভারি";
}
