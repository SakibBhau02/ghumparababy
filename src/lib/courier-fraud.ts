import { db } from "@/lib/db";
import {
  ALL_COURIER_IDS,
  DEFAULT_FRAUD_CONFIG,
  mapPathaoRiskLevel,
  normalizeBdPhone,
  sanitizeFraudConfig,
  type CourierFraudResult,
  type CourierId,
  type FraudCheckResult,
  type FraudConfig,
  type FraudSource,
} from "@/lib/fraud-shared";

export const FRAUD_SETTING_KEY = "fraud_config";
const FRAUD_CACHE_PREFIX = "fraud_cache_";
/** How long a fraud result is reused without re-hitting the couriers. */
const RESULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** Auth token/session reuse window (couriers throttle logins at ~10 attempts). */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const REQ_TIMEOUT_MS = 20000;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Read fraud config from DB (safe defaults on any problem). */
export async function getFraudConfig(): Promise<FraudConfig> {
  try {
    const row = await db.setting.findUnique({ where: { key: FRAUD_SETTING_KEY } });
    if (row) {
      const parsed = sanitizeFraudConfig(JSON.parse(row.value));
      if (parsed) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_FRAUD_CONFIG;
}

/** Persist fraud config (admin only). */
export async function saveFraudConfig(config: FraudConfig): Promise<void> {
  const sane = sanitizeFraudConfig(config) ?? DEFAULT_FRAUD_CONFIG;
  await db.setting.upsert({
    where: { key: FRAUD_SETTING_KEY },
    update: { value: JSON.stringify(sane) },
    create: { key: FRAUD_SETTING_KEY, value: JSON.stringify(sane) },
  });
}

// ---------------------------------------------------------------------------
// Small HTTP helpers
// ---------------------------------------------------------------------------

async function fetchTimeout(url: string, init: RequestInit = {}, ms = REQ_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseSetCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const getter = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    const raws: string[] =
      typeof getter === "function"
        ? getter.call(res.headers)
        : (() => {
            const single = res.headers.get("set-cookie");
            return single ? [single] : [];
          })();
    for (const c of raws) {
      const pair = c.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  } catch {
    // no cookies
  }
  return out;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** Extract Laravel CSRF token (tolerant of attribute order + meta tag + inline JS). */
function extractCsrfToken(html: string): string | null {
  if (!html) return null;
  const patterns = [
    /name="_token"\s+value="([^"]+)"/,
    /value="([^"]+)"\s+name="_token"/,
    /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i,
    /csrfToken["']?\s*[:=]\s*["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function safeJson(res: Response): Promise<unknown | null> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function ratio(delivered: number, total: number): number {
  return total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0;
}

// ---------------------------------------------------------------------------
// In-memory token/session cache (per server instance; couriers throttle logins)
// ---------------------------------------------------------------------------

type MemEntry = { value: unknown; expires: number };
const memCache = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const e = memCache.get(key);
  if (!e || Date.now() > e.expires) {
    memCache.delete(key);
    return null;
  }
  return e.value as T;
}

function memSet(key: string, value: unknown, ttlMs: number): void {
  memCache.set(key, { value, expires: Date.now() + ttlMs });
}

function memDel(key: string): void {
  memCache.delete(key);
}

// ---------------------------------------------------------------------------
// Steadfast — Laravel merchant portal (scraped, no public API)
// GET /login (CSRF) → POST /login → GET /user/frauds/check/{phone}
// ---------------------------------------------------------------------------

const SF_BASES = ["https://steadfast.com.bd", "https://packzy.com"];

async function steadfastLogin(
  base: string,
  user: string,
  password: string
): Promise<Record<string, string> | null> {
  const loginUrl = `${base}/login`;
  const page = await fetchTimeout(loginUrl, {
    headers: { ...BROWSER_HEADERS, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  if (!page.ok && !isRedirect(page.status)) return null;
  const html = await page.text();
  const token = extractCsrfToken(html);
  if (!token) return null;
  let cookies = parseSetCookies(page);
  const xsrf = cookies["XSRF-TOKEN"] ? decodeURIComponent(cookies["XSRF-TOKEN"]) : "";
  const res = await fetchTimeout(loginUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: cookieHeader(cookies),
      "X-XSRF-TOKEN": xsrf,
      Referer: loginUrl,
      Origin: base,
    },
    body: new URLSearchParams({ _token: token, email: user, password }).toString(),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  const location = res.headers.get("location") ?? "";
  // Success = redirect away from /login. A 200 re-render or bounce to /login = bad creds.
  if (!isRedirect(res.status) || /\/login/.test(location)) return null;
  cookies = { ...cookies, ...parseSetCookies(res) };
  if (Object.keys(cookies).length === 0) return null;
  // Follow the redirect once to complete the session (best effort).
  try {
    await fetchTimeout(new URL(location, base).href, {
      redirect: "manual",
      headers: { ...BROWSER_HEADERS, Cookie: cookieHeader(cookies) },
    });
  } catch {
    // session cookie is usually already complete
  }
  return cookies;
}

async function checkSteadfastFraud(
  user: string,
  password: string,
  phone: string
): Promise<CourierFraudResult | string> {
  try {
    for (const base of SF_BASES) {
      try {
        const cacheKey = `sf_cookies:${base}`;
        for (let pass = 0; pass < 2; pass++) {
          let cookies = memGet<Record<string, string>>(cacheKey);
          if (!cookies) {
            const fresh = await steadfastLogin(base, user, password);
            if (!fresh) break; // bad creds or portal moved — try next host
            memSet(cacheKey, fresh, TOKEN_TTL_MS);
            cookies = fresh;
          }
          const res = await fetchTimeout(`${base}/user/frauds/check/${encodeURIComponent(phone)}`, {
            headers: {
              ...BROWSER_HEADERS,
              Accept: "application/json, text/plain, */*",
              "X-Requested-With": "XMLHttpRequest",
              Referer: `${base}/user/frauds/check`,
              Cookie: cookieHeader(cookies),
            },
          });
          const ct = res.headers.get("content-type") ?? "";
          if (res.ok && ct.includes("json")) {
            const data = (await safeJson(res)) as {
              total_delivered?: unknown;
              total_cancelled?: unknown;
              frauds?: unknown;
            } | null;
            if (data && typeof data === "object") {
              const delivered = Number(data.total_delivered ?? 0) || 0;
              const cancelled = Number(data.total_cancelled ?? 0) || 0;
              const total = delivered + cancelled;
              const frauds: CourierFraudResult["frauds"] = [];
              if (Array.isArray(data.frauds)) {
                for (const f of data.frauds.slice(0, 20)) {
                  const r = f as Record<string, unknown>;
                  frauds!.push({
                    name: typeof r.name === "string" ? r.name : null,
                    phone: typeof r.phone === "string" ? r.phone : null,
                    details: typeof r.details === "string" ? r.details : null,
                    image: typeof r.image === "string" ? r.image : null,
                    consignmentId:
                      r.consignment_id !== undefined && r.consignment_id !== null
                        ? String(r.consignment_id)
                        : null,
                    createdAt: typeof r.created_at === "string" ? r.created_at : null,
                  });
                }
              }
              return {
                delivered,
                cancelled,
                total,
                successRatio: ratio(delivered, total),
                frauds,
                fraudReportCount: frauds!.length,
              };
            }
          }
          // Stale session (HTML login page / 401) → drop cache and re-login once.
          memDel(cacheKey);
          if (res.status === 429) return "Steadfast: বেশি চেষ্টা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন";
        }
      } catch (e) {
        if (e instanceof Error && e.message === "RATE_LIMITED") {
          return "Steadfast: বেশি চেষ্টা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন";
        }
        // host unreachable → try next base
      }
    }
    return "Steadfast সংযোগ ব্যর্থ (লগইন/পোর্টাল যাচাই করুন)";
  } catch {
    return "Steadfast সংযোগ ব্যর্থ";
  }
}

// ---------------------------------------------------------------------------
// Pathao — official merchant API (now rating-based for most accounts)
// POST /api/v1/login → POST /api/v1/user/success
// ---------------------------------------------------------------------------

function firstNumeric(sources: Array<Record<string, unknown>>, keys: string[]): number | null {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    }
  }
  return null;
}

async function pathaoLogin(user: string, password: string): Promise<string | null> {
  const res = await fetchTimeout("https://merchant.pathao.com/api/v1/login", {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: user, password }),
  });
  if (!res.ok) return null;
  const data = (await safeJson(res)) as { access_token?: unknown } | null;
  const token = typeof data?.access_token === "string" ? data.access_token.trim() : "";
  return token || null;
}

async function checkPathaoFraud(
  user: string,
  password: string,
  phone: string
): Promise<CourierFraudResult | string> {
  try {
    for (let pass = 0; pass < 2; pass++) {
      let token = memGet<string>("pathao_token");
      if (!token) {
        const fresh = await pathaoLogin(user, password);
        if (!fresh) return "Pathao লগইন ব্যর্থ (email/password যাচাই করুন)";
        memSet("pathao_token", fresh, TOKEN_TTL_MS);
        token = fresh;
      }
      const res = await fetchTimeout("https://merchant.pathao.com/api/v1/user/success", {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          Authorization: `Bearer ${token}`,
          Origin: "https://merchant.pathao.com",
          Referer: "https://merchant.pathao.com/",
        },
        body: JSON.stringify({ phone }),
      });
      if (res.status === 401) {
        memDel("pathao_token");
        continue;
      }
      if (!res.ok) return "Pathao fraud check ব্যর্থ";
      const obj = (await safeJson(res)) as {
        data?: {
          customer?: Record<string, unknown>;
          customer_rating?: unknown;
          show_count?: unknown;
          [k: string]: unknown;
        };
      } | null;
      const payload = obj?.data && typeof obj.data === "object" ? obj.data : {};
      const customer =
        payload.customer && typeof payload.customer === "object"
          ? (payload.customer as Record<string, unknown>)
          : {};
      const rating =
        typeof payload.customer_rating === "string"
          ? payload.customer_rating
          : typeof customer.rating === "string"
            ? (customer.rating as string)
            : null;
      const showCount = payload.show_count ?? null;
      const success = firstNumeric([customer, payload as Record<string, unknown>], [
        "successful_delivery",
        "successful_deliveries",
        "success",
        "delivered",
        "total_delivered",
      ]);
      const total = firstNumeric([customer, payload as Record<string, unknown>], [
        "total_delivery",
        "total_deliveries",
        "total",
        "total_parcel",
        "total_order",
      ]);
      // Pathao hides counts for most accounts (rating-only model) — surface the
      // rating instead of fabricating 0/0.
      if (showCount === false || (success === null && total === null)) {
        return {
          delivered: 0,
          cancelled: 0,
          total: 0,
          successRatio: 0,
          customerRating: rating,
          pathaoRisk: mapPathaoRiskLevel(rating),
          countsAvailable: false,
        };
      }
      const s = success ?? 0;
      const t = total ?? 0;
      const c = Math.max(0, t - s);
      return {
        delivered: s,
        cancelled: c,
        total: t,
        successRatio: ratio(s, t),
        customerRating: rating,
        pathaoRisk: mapPathaoRiskLevel(rating),
        countsAvailable: true,
      };
    }
    return "Pathao সংযোগ ব্যর্থ";
  } catch {
    return "Pathao সংযোগ ব্যর্থ";
  }
}

// ---------------------------------------------------------------------------
// RedX — merchant API (NO OTP needed on this path)
// POST api.redx.com.bd/v4/auth/login → GET customer-success-return-rate
// ---------------------------------------------------------------------------

function normalizeLoginPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("880") ? `0${digits.slice(3)}` : digits;
  return local;
}

async function redxLogin(user: string, password: string): Promise<string | null> {
  const res = await fetchTimeout("https://api.redx.com.bd/v4/auth/login", {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://redx.com.bd",
      Referer: "https://redx.com.bd/",
    },
    body: JSON.stringify({ phone: `88${normalizeLoginPhone(user)}`, password }),
  });
  if (!res.ok) return null;
  const data = (await safeJson(res)) as { data?: { accessToken?: unknown } } | null;
  const token = data?.data?.accessToken;
  return typeof token === "string" && token ? token : null;
}

async function checkRedxFraud(
  user: string,
  password: string,
  phone: string
): Promise<CourierFraudResult | string> {
  try {
    for (let pass = 0; pass < 2; pass++) {
      let token = memGet<string>("redx_token");
      if (!token) {
        const fresh = await redxLogin(user, password);
        if (!fresh) return "RedX লগইন ব্যর্থ (ফোন/password যাচাই করুন)";
        memSet("redx_token", fresh, TOKEN_TTL_MS);
        token = fresh;
      }
      const res = await fetchTimeout(
        `https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=${encodeURIComponent(`88${phone}`)}`,
        {
          headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/json",
            Accept: "application/json, text/plain, */*",
            Authorization: `Bearer ${token}`,
            Origin: "https://redx.com.bd",
            Referer: "https://redx.com.bd/",
          },
        }
      );
      if (res.status === 401) {
        memDel("redx_token");
        continue;
      }
      if (!res.ok) return "RedX fraud check ব্যর্থ";
      const obj = (await safeJson(res)) as {
        data?: { deliveredParcels?: unknown; totalParcels?: unknown; customerSegment?: unknown };
      } | null;
      const d = obj?.data ?? {};
      const delivered = Number(d.deliveredParcels ?? 0) || 0;
      const total = Number(d.totalParcels ?? 0) || 0;
      const cancelled = Math.max(0, total - delivered);
      return {
        delivered,
        cancelled,
        total,
        successRatio: ratio(delivered, total),
        customerSegment: typeof d.customerSegment === "string" ? d.customerSegment : null,
      };
    }
    return "RedX সংযোগ ব্যর্থ";
  } catch {
    return "RedX সংযোগ ব্যর্থ";
  }
}

// ---------------------------------------------------------------------------
// Paperfly — Merchant Reactor API
// POST .../login_using_password.php → POST .../smart-check-v2.php
// ---------------------------------------------------------------------------

const PF_BASE = "https://go-app.paperfly.com.bd/merchant/api/react";
const PF_KEY = "Paperfly_~La?Rj73FcLm";

async function paperflyLogin(user: string, password: string): Promise<string | null> {
  const res = await fetchTimeout(`${PF_BASE}/authentication/login_using_password.php`, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://go.paperfly.com.bd",
      Referer: "https://go.paperfly.com.bd/",
    },
    body: JSON.stringify({ username: user, password }),
  });
  if (!res.ok) return null;
  const data = (await safeJson(res)) as {
    token?: unknown;
    user?: { token?: unknown };
  } | null;
  const token = data?.token ?? data?.user?.token;
  return typeof token === "string" && token ? token : null;
}

async function checkPaperflyFraud(
  user: string,
  password: string,
  phone: string
): Promise<CourierFraudResult | string> {
  try {
    for (let pass = 0; pass < 2; pass++) {
      let token = memGet<string>("paperfly_token");
      if (!token) {
        const fresh = await paperflyLogin(user, password);
        if (!fresh) return "Paperfly লগইন ব্যর্থ (username/password যাচাই করুন)";
        memSet("paperfly_token", fresh, TOKEN_TTL_MS);
        token = fresh;
      }
      const res = await fetchTimeout(
        `${PF_BASE}/smart-check/smart-check-v2.php?search_text=${encodeURIComponent(phone)}`,
        {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/json",
            Accept: "application/json, text/plain, */*",
            Authorization: `Bearer ${token}`,
            paperflykey: PF_KEY,
            Origin: "https://go.paperfly.com.bd",
            Referer: "https://go.paperfly.com.bd/",
          },
          body: JSON.stringify({ search_text: phone }),
        }
      );
      if (res.status === 401) {
        memDel("paperfly_token");
        continue;
      }
      if (!res.ok) return "Paperfly fraud check ব্যর্থ";
      const data = (await safeJson(res)) as {
        delivered?: unknown;
        partial?: unknown;
        returned?: unknown;
        total?: unknown;
        smart_check?: {
          label?: unknown;
          color?: unknown;
          icon?: unknown;
          note?: unknown;
          delivery_rate?: unknown;
        };
      } | null;
      if (!data || typeof data !== "object") return "Paperfly fraud check ব্যর্থ";
      const delivered = Number(data.delivered ?? 0) || 0;
      const partial = Number(data.partial ?? 0) || 0;
      const returned = Number(data.returned ?? 0) || 0;
      const total = Number(data.total ?? 0) || delivered + partial + returned;
      // Success = delivered; anything returned counts as cancelled (partial is neutral).
      const cancelled = returned;
      const sc = data.smart_check ?? {};
      return {
        delivered,
        cancelled,
        total,
        successRatio: ratio(delivered, total),
        partial,
        returned,
        label: typeof sc.label === "string" ? sc.label : null,
        color: typeof sc.color === "string" ? sc.color : null,
        icon: typeof sc.icon === "string" ? sc.icon : null,
        note: typeof sc.note === "string" ? sc.note : null,
      };
    }
    return "Paperfly সংযোগ ব্যর্থ";
  } catch {
    return "Paperfly সংযোগ ব্যর্থ";
  }
}

// ---------------------------------------------------------------------------
// Carrybee — NextAuth merchant portal
// GET /api/auth/csrf → POST /api/auth/callback/login → GET /api/auth/session
// → GET api-merchant.../businesses/{id}/customers/+880...
// ---------------------------------------------------------------------------

const CB_MERCHANT = "https://merchant.carrybee.com";
const CB_API = "https://api-merchant.carrybee.com";

type CarrybeeAuth = { accessToken: string; businessId: string };

async function carrybeeLogin(user: string, password: string): Promise<CarrybeeAuth | null> {
  // Step 1: CSRF token + cookies
  const csrfRes = await fetchTimeout(`${CB_MERCHANT}/api/auth/csrf`, {
    headers: { ...BROWSER_HEADERS, Accept: "application/json", Referer: `${CB_MERCHANT}/login` },
  });
  if (!csrfRes.ok) return null;
  const csrfJson = (await safeJson(csrfRes)) as { csrfToken?: unknown } | null;
  const csrfToken = typeof csrfJson?.csrfToken === "string" ? csrfJson.csrfToken : "";
  if (!csrfToken) return null;
  let cookies = parseSetCookies(csrfRes);

  // Step 2: credential login (NextAuth form flow)
  const loginPhone = `+88${normalizeLoginPhone(user).replace(/^0/, "")}`;
  const loginRes = await fetchTimeout(`${CB_MERCHANT}/api/auth/callback/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Cookie: cookieHeader(cookies),
      Referer: `${CB_MERCHANT}/login`,
      Origin: CB_MERCHANT,
    },
    body: new URLSearchParams({
      phone: loginPhone,
      password,
      csrfToken,
      callbackUrl: `${CB_MERCHANT}/login`,
    }).toString(),
  });
  cookies = { ...cookies, ...parseSetCookies(loginRes) };
  if (!loginRes.ok && !isRedirect(loginRes.status)) return null;

  // Step 3: session → Bearer token + business id (cookies REQUIRED here)
  const sessRes = await fetchTimeout(`${CB_MERCHANT}/api/auth/session`, {
    headers: { ...BROWSER_HEADERS, Accept: "application/json", Cookie: cookieHeader(cookies), Referer: `${CB_MERCHANT}/login` },
  });
  if (!sessRes.ok) return null;
  const sess = (await safeJson(sessRes)) as {
    accessToken?: unknown;
    access_token?: unknown;
    user?: {
      accessToken?: unknown;
      access_token?: unknown;
      selectedBusinessId?: unknown;
      businessId?: unknown;
      business_id?: unknown;
    };
  } | null;
  const accessToken =
    (typeof sess?.accessToken === "string" && sess.accessToken) ||
    (typeof sess?.access_token === "string" && sess.access_token) ||
    (typeof sess?.user?.accessToken === "string" && sess.user.accessToken) ||
    (typeof sess?.user?.access_token === "string" && sess.user.access_token) ||
    "";
  const businessId =
    (sess?.user?.selectedBusinessId !== undefined && sess?.user?.selectedBusinessId !== null
      ? String(sess.user.selectedBusinessId)
      : "") ||
    (sess?.user?.businessId !== undefined && sess?.user?.businessId !== null
      ? String(sess.user.businessId)
      : "");
  if (!accessToken || !businessId) return null;
  return { accessToken, businessId };
}

async function checkCarrybeeFraud(
  user: string,
  password: string,
  phone: string
): Promise<CourierFraudResult | string> {
  try {
    for (let pass = 0; pass < 2; pass++) {
      let auth = memGet<CarrybeeAuth>("carrybee_auth");
      if (!auth) {
        const fresh = await carrybeeLogin(user, password);
        if (!fresh) return "Carrybee লগইন ব্যর্থ (ফোন/password যাচাই করুন)";
        memSet("carrybee_auth", fresh, TOKEN_TTL_MS + 5 * 60 * 1000);
        auth = fresh;
      }
      const fullPhone = `+880${phone.replace(/^0/, "")}`;
      const res = await fetchTimeout(
        `${CB_API}/api/v2/businesses/${encodeURIComponent(auth.businessId)}/customers/${encodeURIComponent(fullPhone)}`,
        {
          headers: {
            ...BROWSER_HEADERS,
            Accept: "application/json",
            Authorization: `Bearer ${auth.accessToken}`,
            Origin: CB_MERCHANT,
            Referer: `${CB_MERCHANT}/`,
          },
        }
      );
      if (res.status === 404) {
        return { delivered: 0, cancelled: 0, total: 0, successRatio: 0, fraudCount: 0 };
      }
      if (res.status === 401) {
        memDel("carrybee_auth");
        continue;
      }
      if (!res.ok) return "Carrybee fraud check ব্যর্থ";
      const raw = (await safeJson(res)) as {
        error?: unknown;
        message?: unknown;
        data?: { total_order?: unknown; cancelled_order?: unknown; success_rate?: unknown; fraud_count?: unknown };
      } | null;
      if (!raw || typeof raw !== "object" || !raw.data || raw.error === true) {
        return "Carrybee fraud check ব্যর্থ";
      }
      const d = raw.data;
      const total = Number(d.total_order ?? 0) || 0;
      const cancelled = Number(d.cancelled_order ?? 0) || 0;
      const delivered = Math.max(0, total - cancelled);
      const apiRate = Number(d.success_rate);
      return {
        delivered,
        cancelled,
        total,
        successRatio: total > 0 && Number.isFinite(apiRate) ? apiRate : ratio(delivered, total),
        fraudCount: Number(d.fraud_count ?? 0) || 0,
      };
    }
    return "Carrybee সংযোগ ব্যর্থ";
  } catch {
    return "Carrybee সংযোগ ব্যর্থ";
  }
}

const COURIER_CHECKERS: Record<
  CourierId,
  (user: string, password: string, phone: string) => Promise<CourierFraudResult | string>
> = {
  steadfast: checkSteadfastFraud,
  pathao: checkPathaoFraud,
  redx: checkRedxFraud,
  paperfly: checkPaperflyFraud,
  carrybee: checkCarrybeeFraud,
};

// ---------------------------------------------------------------------------
// FraudBD — third-party aggregator (fallback when merchant login missing/fails)
// Docs: https://fraudbd.com/api-documentation
// ---------------------------------------------------------------------------

type FraudbdSummary = {
  total: number;
  delivered: number;
  cancelled: number;
  result: CourierFraudResult;
};

function mapFraudbdCourier(name: string, s: Record<string, unknown>): FraudbdSummary | null {
  const lower = name.toLowerCase();
  const asNum = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  if (s.data_type === "rating") {
    // Pathao rating model — no counts, only a qualitative rating.
    const rating = typeof s.customer_rating === "string" ? s.customer_rating : null;
    return {
      total: 0,
      delivered: 0,
      cancelled: 0,
      result: {
        delivered: 0,
        cancelled: 0,
        total: 0,
        successRatio: 0,
        customerRating: rating,
        pathaoRisk: mapPathaoRiskLevel(rating),
        countsAvailable: false,
      },
    };
  }
  const total = asNum(s.total);
  const delivered = asNum(s.success ?? s.delivered);
  const cancelled = Math.max(0, asNum(s.cancel) || total - delivered);
  const t = total || delivered + cancelled;
  const base: CourierFraudResult = {
    delivered,
    cancelled,
    total: t,
    successRatio: ratio(delivered, t),
  };
  if (lower.includes("redx") && typeof s.customerSegment === "string") {
    base.customerSegment = s.customerSegment as string;
  }
  void lower;
  return { total: t, delivered, cancelled, result: base };
}

const FRAUDBD_COURIER_MAP: Record<string, CourierId> = {
  steadfast: "steadfast",
  pathao: "pathao",
  redx: "redx",
  paperfly: "paperfly",
  carrybee: "carrybee",
};

async function checkFraudbd(
  apiKey: string,
  sandbox: boolean,
  phone: string
): Promise<{ results: Partial<Record<CourierId, CourierFraudResult>>; error: string | null }> {
  try {
    const base = sandbox ? "https://fraudbd.com/api/sandbox" : "https://fraudbd.com/api";
    const res = await fetchTimeout(`${base}/check-courier-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", api_key: apiKey },
      body: JSON.stringify({ phone_number: phone }),
    });
    const obj = (await safeJson(res)) as {
      status?: unknown;
      message?: unknown;
      data?: { Summaries?: Record<string, Record<string, unknown>> };
    } | null;
    if (!res.ok || !obj || obj.status !== true) {
      const msg = typeof obj?.message === "string" ? obj.message : `FraudBD এরর (${res.status})`;
      return { results: {}, error: msg.slice(0, 200) };
    }
    const summaries = obj.data?.Summaries ?? {};
    const results: Partial<Record<CourierId, CourierFraudResult>> = {};
    for (const [name, s] of Object.entries(summaries)) {
      const id = FRAUDBD_COURIER_MAP[name.toLowerCase()];
      if (!id || !s || typeof s !== "object") continue;
      const mapped = mapFraudbdCourier(name, s);
      if (mapped) results[id] = mapped.result;
    }
    return { results, error: null };
  } catch {
    return { results: {}, error: "FraudBD সংযোগ ব্যর্থ" };
  }
}

// ---------------------------------------------------------------------------
// Orchestration — direct primary, FraudBD fills gaps (hybrid)
// ---------------------------------------------------------------------------

/** Run fraud check across all configured couriers for a phone number. */
export async function checkFraud(config: FraudConfig, phone: string): Promise<FraudCheckResult> {
  const clean = normalizeBdPhone(phone);
  const courierResults: Partial<Record<CourierId, CourierFraudResult>> = {};
  const errors: Partial<Record<CourierId, string>> = {};
  const sources: Partial<Record<CourierId, FraudSource>> = {};

  const activeCouriers = ALL_COURIER_IDS.filter(
    (id) => config.credentials[id]?.user && config.credentials[id]?.password
  );

  // Run all direct courier checks in parallel
  const settled = await Promise.allSettled(
    activeCouriers.map(async (id) => {
      const cred = config.credentials[id]!;
      const result = await COURIER_CHECKERS[id](cred.user, cred.password, clean);
      return { id, result };
    })
  );

  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    if (typeof r.value.result === "string") {
      errors[r.value.id] = r.value.result;
    } else {
      courierResults[r.value.id] = r.value.result;
      sources[r.value.id] = "direct";
    }
  }

  // FraudBD fallback: fill couriers that have no direct result (missing creds or failed).
  if (config.fraudbdFallback && config.fraudbdApiKey) {
    const missing = ALL_COURIER_IDS.filter((id) => !courierResults[id]);
    if (missing.length > 0) {
      const fb = await checkFraudbd(config.fraudbdApiKey, config.fraudbdSandbox, clean);
      for (const id of missing) {
        const mapped = fb.results[id];
        if (mapped && (mapped.total > 0 || mapped.customerRating)) {
          courierResults[id] = mapped;
          sources[id] = "fraudbd";
          delete errors[id];
        } else if (!errors[id] && fb.error) {
          errors[id] = fb.error;
        }
      }
    }
  }

  // Aggregate numeric counts (Pathao rating-only entries carry total 0, so a plain
  // sum is safe and matches the industry-standard totalSummary).
  let delivered = 0;
  let cancelled = 0;
  for (const r of Object.values(courierResults)) {
    delivered += r?.delivered ?? 0;
    cancelled += r?.cancelled ?? 0;
  }
  const total = delivered + cancelled;
  return {
    phone: clean,
    couriers: courierResults,
    aggregated: { delivered, cancelled, total, successRatio: ratio(delivered, total) },
    checkedAt: new Date().toISOString(),
    errors,
    sources,
  };
}

// ---------------------------------------------------------------------------
// Result cache (DB-backed, 12h) — powers order-row badges + auto-check warmup
// ---------------------------------------------------------------------------

export async function getFraudCache(phone: string): Promise<FraudCheckResult | null> {
  try {
    const clean = normalizeBdPhone(phone);
    if (!clean) return null;
    const row = await db.setting.findUnique({ where: { key: `${FRAUD_CACHE_PREFIX}${clean}` } });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as { savedAt: number; result: FraudCheckResult };
    if (!parsed?.result || Date.now() - (parsed.savedAt ?? 0) > RESULT_CACHE_TTL_MS) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

export async function saveFraudCache(result: FraudCheckResult): Promise<void> {
  try {
    const key = `${FRAUD_CACHE_PREFIX}${result.phone}`;
    await db.setting.upsert({
      where: { key },
      update: { value: JSON.stringify({ savedAt: Date.now(), result }) },
      create: { key, value: JSON.stringify({ savedAt: Date.now(), result }) },
    });
  } catch {
    // cache failure must never break the check
  }
}

/** Cached check — returns the 12h cache unless `fresh` is requested. */
export async function checkFraudCached(
  config: FraudConfig,
  phone: string,
  opts?: { fresh?: boolean }
): Promise<FraudCheckResult> {
  if (!opts?.fresh) {
    const cached = await getFraudCache(phone);
    if (cached) return cached;
  }
  const result = await checkFraud(config, phone);
  await saveFraudCache(result);
  return result;
}

/** Best-effort background warmup (never throws) — used after new orders arrive. */
export function warmFraudCache(config: FraudConfig, phone: string): void {
  checkFraudCached(config, phone).catch(() => {});
}
