import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "gp_admin";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  return process.env.ADMIN_SECRET ?? "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Create a signed session token: "<expiryMs>.<hmac>" */
export function createToken(): string {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}

/** Verify a signed session token (constant-time comparison). */
export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expected = sign(exp);
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return Number(exp) > Date.now();
}

/** Constant-time string compare for credentials. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Check the incoming request carries a valid admin session cookie. */
export function isAdminRequest(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MS / 1000;
