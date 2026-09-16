"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Collapsible settings group — one titled card containing related
 * settings cards. Keeps the settings tab scannable.
 */
export function SettingsGroup({
  icon,
  title,
  desc,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-cream/50 sm:p-5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft/70 text-brand">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{desc}</span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="border-t border-border px-4 pb-5 sm:px-5">{children}</div> : null}
    </div>
  );
}
