/**
 * Single switchboard for all site imagery.
 *
 * Today images ship from Next.js `public/` (R2_IMAGES_LIVE = false).
 * After `node scripts/upload-r2.mjs` copies them to the R2 bucket,
 * flip R2_IMAGES_LIVE to true (one line) and every <Image>, favicon,
 * invoice photo and Telegram alert loads from the bucket instead.
 * No other file needs to change — they all resolve via siteImage().
 */

export const R2_BASE_URL =
  "https://pub-9f2bc7ee02c44d26bb204d4ceb965ccf.r2.dev";

/** Flip to true once the bucket holds /images/* + /logo.svg. */
export const R2_IMAGES_LIVE = true;

/**
 * Cache-bust version. Bump this whenever any image under /images or
 * logo.svg is replaced in the R2 bucket — same-filename updates are
 * otherwise pinned in browsers/CDN by the old cached copy.
 */
export const IMAGE_VERSION = "2";

/** Resolve a "/images/..." or "/logo.svg" path to local or R2 URL. */
export function siteImage(path: string): string {
  if (!path.startsWith("/")) return path;
  return R2_IMAGES_LIVE
    ? `${R2_BASE_URL}${path}?v=${IMAGE_VERSION}`
    : `${path}?v=${IMAGE_VERSION}`;
}
