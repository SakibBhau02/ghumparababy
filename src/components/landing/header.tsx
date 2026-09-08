"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Countdown } from "./countdown";
import { HOTLINE, HOTLINE_LINK } from "@/lib/landing-data";
import { pixelTrack } from "@/lib/pixel";
import { Phone } from "lucide-react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-brand-deep text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-1.5 text-xs sm:text-sm">
          <span className="hidden sm:inline">🔥 আজকের অফার শেষ হচ্ছে আজ রাত ১২টায় —</span>
          <span className="sm:hidden">🔥 অফার শেষ হচ্ছে —</span>
          <Countdown compact />
        </div>
      </div>

      {/* Main nav */}
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? "bg-cream/95 shadow-md backdrop-blur border-b border-border"
            : "bg-cream/70 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <a href="#top" className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧸</span>
            <div className="leading-tight">
              <div className="font-bold text-ink">
                ঘুমপাড়া <span className="text-brand">বেবি</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                শান্ত ঘুম • নিরাপদ শৈশব
              </div>
            </div>
          </a>

          <div className="flex items-center gap-2">
            <a
              href={HOTLINE_LINK}
              onClick={() => pixelTrack("Contact", { method: "call", location: "header" })}
              className="hidden items-center gap-1.5 text-sm font-medium text-ink md:flex"
            >
              <Phone className="size-4 text-brand" />
              {HOTLINE}
            </a>
            <a href="#order">
              <Button className="rounded-full bg-brand font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand-deep">
                অর্ডার করুন
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
