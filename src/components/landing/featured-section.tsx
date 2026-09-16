"use client";

import Image from "next/image";
import { toBn } from "@/lib/landing-data";
import type { CatalogOrderLine } from "@/lib/catalog-shared";
import { Flame, Star } from "lucide-react";

/**
 * Featured-products showcase (DB-driven via CatalogOrderLine[]).
 * Admin pins products with the Featured switch; hidden when empty.
 * Actual picking happens inside the order form (same order, mixed cart).
 */
export function FeaturedSection({
  items,
  fromPrice,
}: {
  items: CatalogOrderLine[];
  /** Uniform tier-anchored starting price ("৳X থেকে"). */
  fromPrice: number;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section id="featured" className="relative scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-honey px-4 py-1.5 text-sm font-semibold text-ink">
            <Star className="size-4" /> বিশেষ অফার
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            স্পেশাল প্রোডাক্ট
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            ঘুমপাড়া বেবির সাথে একই অর্ডারে নিন, আলাদা ডেলিভারি চার্জ নেই।
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
          {items.map((p) => (
            <div
              key={`${p.productId}${p.variantId ? `-${p.variantId}` : ""}`}
              className="overflow-hidden rounded-[1.5rem] border border-border bg-white shadow-lg shadow-brand/5"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={p.image}
                  alt={`${p.name} (${p.variantLabel})`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 90vw, 30vw"
                />
                <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                  {p.variantLabel}
                </span>
                {p.stock > 0 && p.stock <= 10 ? (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rust/90 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Flame className="size-3" /> শুধু {toBn(p.stock)}টা বাকি
                  </span>
                ) : null}
              </div>
              <div className="p-4 text-center">
                <div className="font-bold text-ink">{p.name}</div>
                <div className="mt-1">
                  <span className="text-xl font-bold text-brand">৳{toBn(fromPrice)} থেকে</span>{" "}
                  <span className="text-sm text-muted-foreground line-through">
                    ৳{toBn(p.oldPrice)}
                  </span>
                </div>
                <a
                  href="#order"
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-bold text-white hover:bg-brand-deep"
                >
                  অর্ডার করুন
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
