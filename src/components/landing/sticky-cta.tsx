"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toBn } from "@/lib/landing-data";
import type { ProductConfig } from "@/lib/product-shared";
import { priceForQty } from "@/lib/product-shared";
import { deliveryBadgeText, type DeliveryConfig } from "@/lib/delivery-shared";

export function StickyCTA({
  deliveryConfig,
  productConfig,
}: {
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
}) {
  const singlePrice = priceForQty(productConfig, 1).total;
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="whitespace-nowrap text-base font-bold text-ink sm:text-lg">৳{toBn(singlePrice)}</span>
            <span className="whitespace-nowrap text-xs text-muted-foreground line-through sm:text-sm">৳{toBn(899)}</span>
          </div>
          <div className="truncate text-[11px] font-medium text-leaf sm:text-xs">✓ ক্যাশ অন ডেলিভারি • {deliveryBadgeText(deliveryConfig)}</div>
        </div>
        <a href="#order" className="shrink-0">
          <Button
            size="lg"
            className="animate-gentle-pulse whitespace-nowrap rounded-full bg-brand px-5 text-sm font-bold text-white shadow-lg hover:bg-brand-deep sm:px-8 sm:text-base"
          >
            এখনই অর্ডার করুন
          </Button>
        </a>
      </div>
    </div>
  );
}
