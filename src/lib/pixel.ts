declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    /** Admin panel-এ সেভ করা ইভেন্ট ফ্ল্যাগ — facebook-pixel.tsx ইনজেক্ট করে */
    __PIXEL_EVENTS__?: Record<string, boolean>;
  }
}

/**
 * fbq event name → admin config key ম্যাপিং
 */
const EVENT_KEY: Record<string, string> = {
  PageView: "pageView",
  ViewContent: "viewContent",
  InitiateCheckout: "initiateCheckout",
  Purchase: "purchase",
  Contact: "contact",
};

/**
 * Safely fire a Meta (Facebook) Pixel event.
 * No-ops when:
 *  - Pixel installed না (fbq ফাংশন নেই), অথবা
 *  - Admin panel থেকে ওই ইভেন্ট বন্ধ করা হয়েছে (__PIXEL_EVENTS__ এ false)
 */
export function pixelTrack(
  event: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;

  const key = EVENT_KEY[event];
  if (key && window.__PIXEL_EVENTS__?.[key] === false) return;

  window.fbq("track", event, data ?? {});
}
