"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ImageIcon,
  Package,
  Settings2,
  ShoppingBag,
  Truck,
} from "lucide-react";

/**
 * Shared admin chrome: desktop sidebar + mobile top nav.
 * Login + print routes render bare (no chrome).
 */
const NAV = [
  { href: "/admin", label: "অর্ডার", icon: ShoppingBag, match: "orders" },
  { href: "/admin/catalog", label: "প্রোডাক্টস", icon: Package, match: "catalog" },
  { href: "/admin/images", label: "ছবি", icon: ImageIcon, match: "images" },
  { href: "/admin?tab=settings", label: "সেটিংস", icon: Settings2, match: "settings" },
] as const;

function isActive(
  match: string,
  pathname: string,
  tab: string | null
): boolean {
  if (match === "orders") return pathname === "/admin" && tab !== "settings";
  if (match === "settings") return pathname === "/admin" && tab === "settings";
  return pathname === "/admin/catalog" && match === "catalog"
    ? true
    : pathname.startsWith("/admin/catalog") && match === "catalog"
      ? true
      : pathname.startsWith("/admin/images") && match === "images";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  // Bare routes: login screen + printable invoice (no nav chrome).
  if (pathname === "/admin/login" || pathname.startsWith("/admin/print")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-cream/60 lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-white/80 backdrop-blur lg:flex">
        <div className="flex items-center gap-2 px-5 pb-4 pt-6">
          <span className="text-2xl">🧸</span>
          <div>
            <div className="font-bold leading-tight text-ink">ঘুমপাড়া বেবি</div>
            <div className="text-xs text-muted-foreground">অ্যাডমিন প্যানেল</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = isActive(item.match, pathname, tab);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink hover:bg-cream"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
          <Truck className="size-4" />
          সারা দেশে ক্যাশ অন ডেলিভারি
        </div>
      </aside>

      {/* Content + mobile nav */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 px-4 pb-1 pt-3">
            <span className="text-xl">🧸</span>
            <span className="font-bold text-ink">ঘুমপাড়া বেবি</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((item) => {
              const active = isActive(item.match, pathname, tab);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                    active ? "bg-brand text-white" : "text-ink hover:bg-cream"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
