"use client";

import { useEffect, useState } from "react";
import { toBn } from "@/lib/landing-data";

/**
 * "আজ Xটা অর্ডার হয়েছে" লাইভ ব্যাজ (CRO: social proof).
 * একবার আজকের অর্ডার-সংখ্যা fetch করে; cover কমলে দেখায় না।
 */
export function LiveCountBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/live-count", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && typeof data.count === "number" && data.count > 2) {
          setCount(data.count);
        }
      } catch {
        // stay silent — badge is decorative
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;

  return (
    <div
      role="status"
      className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-leaf/40 bg-leaf/10 px-4 py-1.5 text-sm font-semibold text-ink"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-leaf" />
      </span>
      আজ {toBn(count)}টা অর্ডার হয়েছে — স্টক সীমিত, দেরি করবেন না
    </div>
  );
}