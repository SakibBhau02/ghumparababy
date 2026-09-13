/**
 * Pure (client-safe) Bangladeshi mobile-number normalizer — NO server imports.
 * Accepts every common way customers type their number and folds it to the
 * canonical 11-digit form. Server is the source of truth; the order form
 * uses the same function for instant hints.
 *
 * Accepted: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, 008801XXXXXXXXX
 * (spaces / hyphens / brackets ignored). Operator digit must be 3-9.
 */

/** Fold any input to canonical 01XXXXXXXXX, or null when invalid. */
export function normalizeBdPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00880")) {
    digits = "01" + digits.slice(5);
  } else if (digits.startsWith("880")) {
    digits = "0" + digits.slice(3);
  }
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
}

/** Canonical example shown in hints/errors. */
export const BD_PHONE_EXAMPLE = "01712345678";
