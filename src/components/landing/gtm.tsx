"use client";

import Script from "next/script";

/**
 * Google Tag Manager loader — admin panel-চালিত (শুধু script load)।
 *
 * সেটআপ: Admin panel → GTM সেটআপ (/admin/gtm) → Container ID বা GTM-এর
 * পুরো script snippet পেস্ট করে "সংযোগ করুন" চাপলেই এখান থেকে
 * স্বয়ংক্রিয়ভাবে লোড হয়। DB-তে কনফিগ না থাকলে .env এর
 * NEXT_PUBLIC_GTM_ID fallback হিসেবে থাকে (page.tsx সামলায়)।
 *
 * Events/dataLayer এই কম্পোনেন্ট fire করে না — সব ট্যাগ ও ট্রিগার
 * GTM panel (tagmanager.google.com) থেকে ম্যানেজ হয়। সাইট থেকে পাঠানো
 * purchase ইভেন্ট (gtm-data-layer.ts → pushPurchase: ecommerce +
 * top-level phone/customer_name) পড়তে Variables → Data Layer Variable বানান।
 */
export function GtmLoader({ containerId }: { containerId: string }) {
  if (!containerId) return null;

  return (
    <>
      <Script id="gtm-loader" strategy="afterInteractive">
        {`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');
`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
