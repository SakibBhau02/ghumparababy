declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Safely fire a Meta (Facebook) Pixel event.
 * No-ops when the Pixel is not installed (no NEXT_PUBLIC_FACEBOOK_PIXEL_ID).
 */
export function pixelTrack(
  event: string,
  data?: Record<string, unknown>
): void {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, data ?? {});
  }
}
