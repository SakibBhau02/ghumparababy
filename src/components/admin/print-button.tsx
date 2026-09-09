"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
    >
      <Printer className="size-4" /> প্রিন্ট করুন
    </button>
  );
}
