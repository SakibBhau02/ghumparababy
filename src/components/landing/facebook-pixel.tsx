"use client";

import Script from "next/script";

/**
 * Meta (Facebook) Pixel loader.
 *
 * Setup: শুধু .env ফাইলে আপনার Pixel ID বসান →
 *   NEXT_PUBLIC_FACEBOOK_PIXEL_ID=1234567890123456
 * তারপর dev server restart দিন। ID খালি থাকলে কোনো স্ক্রিপ্ট লোড হবে না।
 *
 * Auto-tracked: PageView (এই কম্পোনেন্টে)
 * Manual-tracked: InitiateCheckout + Purchase (অর্ডার ফর্মে)
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

export function FacebookPixel() {
  if (!PIXEL_ID) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');
`}
    </Script>
  );
}
