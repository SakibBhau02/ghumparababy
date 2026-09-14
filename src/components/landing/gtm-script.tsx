"use client";

import Script from "next/script";

/**
 * Google Tag Manager loader — admin panel-চালিত।
 * GTM Container ID সেভ থাকলে স্বয়ংক্রিয়ভাবে <head>-তে লোড হয়।
 * dataLayer init আগেই করা হয়েছে (gtm-data-layer.ts)।
 */
export function GtmScript({ containerId }: { containerId: string }) {
  if (!containerId) return null;

  return (
    <>
      <Script id="gtm-dataLayer" strategy="beforeInteractive">
        {`window.dataLayer = window.dataLayer || [];`}
      </Script>
      <Script id="gtm-script" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`}
      </Script>
    </>
  );
}
