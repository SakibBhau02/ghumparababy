/**
 * One-time upload of site images to the Cloudflare R2 bucket.
 *
 *   $env:R2_ACCESS_KEY_ID="..."; $env:R2_SECRET_ACCESS_KEY="..."
 *   node scripts/upload-r2.mjs
 *
 * (Bash: R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... node scripts/upload-r2.mjs)
 *
 * Zero dependencies — signs PUT requests with SigV4 by hand (R2 region "auto").
 * Files land under images/* + logo.svg with 1-year immutable caching.
 * After a successful run, flip R2_IMAGES_LIVE to true in src/lib/site-images.ts.
 */

import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACCOUNT_ID = "f46625f7d5fc92ca3adfe3ba547a1885";
const ENDPOINT =
  process.env.R2_ENDPOINT ?? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET = process.env.R2_BUCKET ?? "ghumpara";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error(
    "Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY env vars.\n" +
      "Cloudflare dashboard → R2 → API Tokens → Create API Token (Object Read & Write on the ghumpara bucket)."
  );
  process.exit(1);
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ["public/images/swaddle-blue.jpg", "images/swaddle-blue.jpg", "image/jpeg"],
  ["public/images/swaddle-red.jpg", "images/swaddle-red.jpg", "image/jpeg"],
  ["public/images/swaddle-brown.jpg", "images/swaddle-brown.jpg", "image/jpeg"],
  ["public/images/swaddle-pink.jpg", "images/swaddle-pink.jpg", "image/jpeg"],
  ["public/logo.svg", "logo.svg", "image/svg+xml"],
];

const sha256hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

function signPut(key, body, contentType) {
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
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

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

let failed = 0;
for (const [local, key, contentType] of FILES) {
  try {
    const body = await readFile(path.join(ROOT, local));
    const { url, headers } = signPut(key, body, contentType);
    const res = await fetch(url, { method: "PUT", headers, body });
    if (!res.ok) {
      failed++;
      console.error(`FAIL ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    } else {
      console.log(`OK   ${key} (${Math.round(body.length / 1024)} KB)`);
    }
  } catch (e) {
    failed++;
    console.error(`FAIL ${key}: ${e instanceof Error ? e.message : e}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed.`);
  process.exit(1);
}
console.log("\nAll uploaded. Flip R2_IMAGES_LIVE to true in src/lib/site-images.ts.");
