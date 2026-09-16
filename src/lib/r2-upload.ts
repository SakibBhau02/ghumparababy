/**
 * Server-only R2 upload helper: sharp-optimizes an image, PUTs it to the
 * Cloudflare R2 bucket with hand-rolled SigV4 (region "auto"), and returns
 * the public URL. Used by `/api/admin/upload` (admin image uploads).
 */

import { createHash, createHmac } from "node:crypto";
import sharp from "sharp";
import { R2_BASE_URL } from "@/lib/site-images";

const ACCOUNT_ID = "f46625f7d5fc92ca3adfe3ba547a1885";
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET = process.env.R2_BUCKET ?? "ghumpara";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";

const sha256hex = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

function signPut(key: string, body: Buffer, contentType: string) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(ENDPOINT).host;
  const uri = `/${BUCKET}/${key}`;
  const bodyHash = sha256hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    uri,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + SECRET_KEY, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  return {
    url: `${ENDPOINT}${uri}`,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-amz-content-sha256": bodyHash,
      "x-amz-date": amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** Allowed upload content types (admin uploads are images only). */
const ALLOWED_MIME: Record<string, { ext: string }> = {
  "image/jpeg": { ext: "jpg" },
  "image/png": { ext: "png" },
  "image/webp": { ext: "webp" },
};

/** Max upload size (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Optimize + upload an image buffer to R2 under `uploads/<yyyy-mm>/<hash>.<ext>`.
 * Returns the public URL (unique filename → cache-safe, no version param needed).
 */
export async function uploadImageToR2(
  buffer: Buffer
): Promise<{ url: string; width: number; height: number }> {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("R2 credentials missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }

  const src = sharp(buffer).rotate();
  const meta = await src.metadata();
  const mime = meta.format ? `image/${meta.format}` : "";
  const ext = ALLOWED_MIME[mime]?.ext ?? "webp";

  // Downscale to max 1400px wide; strip metadata; keep transparency for PNG.
  let optimized: Buffer;
  if (ext === "png") {
    optimized = await src
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 85, palette: true })
      .toBuffer();
  } else if (ext === "webp") {
    optimized = await src
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } else {
    optimized = await src
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    // converted from jpg → serve as webp
  }
  const outExt = ext === "jpg" ? "webp" : ext;
  const contentType = outExt === "webp" ? "image/webp" : "image/png";

  const date = new Date();
  const folder = `uploads/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const hash = createHash("sha256")
    .update(buffer)
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 16);
  const key = `${folder}/${hash}.${outExt}`;

  const { url, headers } = signPut(key, optimized, contentType);
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: optimized as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  return { url: `${R2_BASE_URL}/${key}`, width: 0, height: 0 };
}

/** True for image mime types accepted by the upload API. */
export function isAllowedImageMime(mime: string): boolean {
  return mime in ALLOWED_MIME;
}