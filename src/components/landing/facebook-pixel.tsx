"use client";

import Script from "next/script";
import type { PixelEvents } from "@/lib/pixel-shared";

/**
 * Meta (Facebook) Pixel loader — admin panel-চালিত।
 *
 * সেটআপ এখন কোড ছাড়াই হয়: Admin panel → Pixel সেটআপ (/admin/pixel) →
 * Pixel ID বা Meta এর পুরো কোড পেস্ট করে "সংযোগ করুন" চাপলেই এখান থেকে
 * স্বয়ংক্রিয়ভাবে লোড হয়। DB-তে কনফিগ না থাকলে .env এর
 * NEXT_PUBLIC_FACEBOOK_PIXEL_ID fallback হিসেবে থাকে (page.tsx সামলায়)।
 *
 * Admin panel-এ যেসব ইভেন্ট চালু করা হয়, শুধু সেগুলোই ফায়ার হয়:
 * - PageView / ViewContent → এই স্ক্রিপ্টেই (events flag অনুযায়ী)
 * - InitiateCheckout / Purchase → অর্ডার ফর্মে
 * - Contact → কল ও WhatsApp বাটনে
 * window.__PIXEL_EVENTS__ দিয়ে client-side গেটিং হয় (src/lib/pixel.ts)।
 */

export function FacebookPixel({
  pixelId,
  events,
  contentName,
  contentValue,
  contentIds,
}: {
  pixelId: string;
  events: PixelEvents;
  contentName: string;
  contentValue: number;
  /** Variant SKUs — ViewContent-এর content_ids-এ যায় (admin থেকে edit হয়)। */
  contentIds: string[];
}) {
  if (!pixelId) return null;

  const eventFlags = JSON.stringify(events);
  const viewContentData = JSON.stringify({
    content_name: contentName,
    content_type: "product",
    content_ids: contentIds,
    value: contentValue,
    currency: "BDT",
  });

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
window.__PIXEL_EVENTS__ = ${eventFlags};
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
${events.pageView ? `fbq('track', 'PageView');` : ""}
${
  events.viewContent
    ? `fbq('track', 'ViewContent', ${viewContentData});`
    : ""
}
`}
    </Script>
  );
}
