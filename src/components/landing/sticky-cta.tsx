"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toBn } from "@/lib/landing-data";

export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const orderSection = document.getElementById("order");
      let nearOrder = false;
      if (orderSection) {
        const rect = orderSection.getBoundingClientRect();
        nearOrder = rect.top < window.innerHeight && rect.bottom > 0;
      }
      setVisible(window.scrollY > 650 && !nearOrder);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-cream/95 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-ink">৳{toBn(549)}</span>
            <span className="text-sm text-muted-foreground line-through">৳{toBn(899)}</span>
          </div>
          <div className="text-xs text-leaf font-medium">✓ ক্যাশ অন ডেলিভারি • ফ্রি ডেলিভারি</div>
        </div>
        <a href="#order">
          <Button
            size="lg"
            className="animate-gentle-pulse rounded-full bg-brand px-8 font-bold text-white shadow-lg hover:bg-brand-deep"
          >
            এখনই অর্ডার করুন
          </Button>
        </a>
      </div>
    </div>
  );
}
