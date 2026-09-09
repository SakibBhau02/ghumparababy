"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_LINK } from "@/lib/landing-data";
import { pixelTrack } from "@/lib/pixel";

/** Official WhatsApp glyph (single-color, inherits currentColor) */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.803 12.8 0 2.257.59 4.46 1.712 6.403L3.2 28.8l6.56-1.72a12.75 12.75 0 0 0 6.24 1.6h.005c7.058 0 12.8-5.74 12.802-12.8 0-3.42-1.331-6.637-3.75-9.055A12.71 12.71 0 0 0 16.004 3.2Zm0 23.382h-.004a10.63 10.63 0 0 1-5.416-1.483l-.389-.23-4.028 1.056 1.076-3.927-.253-.403a10.6 10.6 0 0 1-1.627-5.656c.002-5.868 4.776-10.64 10.645-10.64 2.842 0 5.512 1.108 7.52 3.117a10.57 10.57 0 0 1 3.114 7.527c-.003 5.869-4.776 10.639-10.638 10.639Zm5.835-7.962c-.32-.16-1.89-.932-2.182-1.039-.292-.107-.504-.16-.716.16-.212.32-.823 1.038-1.01 1.25-.185.212-.37.24-.69.08-.32-.16-1.35-.497-2.571-1.585-.95-.847-1.592-1.893-1.778-2.213-.185-.32-.02-.493.14-.652.144-.143.32-.372.48-.558.16-.186.212-.32.32-.532.106-.213.053-.399-.027-.559-.08-.16-.716-1.724-.98-2.361-.258-.62-.52-.536-.716-.546l-.61-.01c-.212 0-.558.08-.85.399-.292.32-1.113 1.088-1.113 2.653s1.14 3.077 1.298 3.29c.16.212 2.242 3.423 5.431 4.798.759.328 1.351.523 1.813.67.762.242 1.455.208 2.003.126.611-.091 1.89-.772 2.156-1.518.266-.746.266-1.385.186-1.519-.08-.133-.292-.212-.612-.372Z" />
    </svg>
  );
}

/**
 * Always-visible floating WhatsApp button (bottom-right corner).
 * Shifts up smoothly when the mobile sticky CTA bar is on screen so
 * the two never overlap. Opens wa.me chat with a pre-filled Bangla message.
 */
export function WhatsAppFloat() {
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const orderSection = document.getElementById("order");
      let nearOrder = false;
      if (orderSection) {
        const rect = orderSection.getBoundingClientRect();
        nearOrder = rect.top < window.innerHeight && rect.bottom > 0;
      }
      setCtaVisible(window.scrollY > 650 && !nearOrder);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => pixelTrack("Contact", { method: "whatsapp", location: "float" })}
      aria-label="WhatsApp-এ মেসেজ দিন"
      title="WhatsApp-এ মেসেজ দিন"
      className={`group fixed right-4 z-[60] flex items-center gap-2.5 rounded-full bg-[#25D366] p-1 pl-1.5 font-bold text-white shadow-[0_6px_24px_rgba(37,211,102,0.45)] transition-all duration-300 hover:bg-[#1ebe5a] sm:right-6 ${
        ctaVisible ? "bottom-24" : "bottom-5"
      }`}
      style={{ paddingBottom: ctaVisible ? undefined : "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      {/* pulsing ring */}
      <span className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-25" />
      <span className="relative grid size-11 place-items-center rounded-full bg-white/15 sm:size-12">
        <WhatsAppIcon className="size-7 sm:size-8" />
      </span>
      <span className="hidden pr-4 text-sm sm:block">WhatsApp-এ অর্ডার / জিজ্ঞাসা</span>
    </a>
  );
}
