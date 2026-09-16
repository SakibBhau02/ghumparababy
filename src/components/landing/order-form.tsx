"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toBn, HOTLINE, WHATSAPP_NUMBER, WHATSAPP_DISPLAY } from "@/lib/landing-data";
import { BD_PHONE_EXAMPLE, normalizeBdPhone } from "@/lib/phone-shared";
import { zoneCharge, isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import {
  FREE_SHIPPING_MIN_QTY,
  isFreeShipping,
  packageNameForQty,
  priceForQty,
  skusForOrder,
  type ProductConfig,
} from "@/lib/product-shared";
import {
  MAIN_PRODUCT_ID,
  NEW_COLLECTION,
  NEW_ITEM_MAX_QTY,
  flattenCatalog,
  type CatalogItem,
  type CatalogOrderLine,
} from "@/lib/catalog-shared";
import type { LocationSelection } from "@/lib/bd-geo";
import { AddressCascade } from "@/components/landing/address-cascade";
import { LiveCountBadge } from "@/components/landing/live-count";
import { pixelTrack } from "@/lib/pixel";
import { CheckCircle2, Flame, Loader2, Phone, ShieldCheck, Truck, ShoppingBag } from "lucide-react";

/** Empty-DB fallback lines (static hooded swaddles, never priced wrong — server re-prices). */
function staticLines(): CatalogOrderLine[] {
  return NEW_COLLECTION.map((p) => ({
    ...p,
    productId: p.id,
    maxQty: NEW_ITEM_MAX_QTY,
    stock: 0,
    featured: false,
  }));
}

function lineKey(l: CatalogOrderLine): string {
  return `${l.productId}${l.variantId ? `:${l.variantId}` : ""}`;
}

/** 01XXXXXXXXX → prettified + normalized (strips 880/+880, keeps digits). */
function autoFormatBdPhone(raw: string): string {
  let d = raw.replace(/\D+/g, "");
  if (d.startsWith("880")) d = "0" + d.slice(3);
  if (d.startsWith("+")) d = d.slice(1);
  if (d.length > 11) d = d.slice(0, 11);
  return d;
}

export function OrderForm({
  deliveryConfig,
  productConfig,
  locationEnabled,
  catalogItems,
}: {
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
  locationEnabled: boolean;
  catalogItems: CatalogItem[];
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState<string>(deliveryConfig.zones[0]?.id ?? "");
  const [location, setLocation] = useState<LocationSelection>({
    division: "",
    district: "",
    upazila: "",
  });
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<{ orderCode: string } | null>(null);
  const [success, setSuccess] = useState<{
    orderCode: string;
    productPrice: number;
    deliveryCharge: number;
    totalPrice: number;
  } | null>(null);

  // Unified buyable list: every active catalog line gets its own row
  // (flattenCatalog orders featured-first, then newest-first).
  // Static fallback when DB is empty.
  const catalogLines = useMemo(() => {
    const fromDb = catalogItems && catalogItems.length > 0 ? flattenCatalog(catalogItems) : [];
    return fromDb.length > 0 ? fromDb : staticLines();
  }, [catalogItems]);

  // THE cart: { "<productId>:<variantId>": qty } — server-truth pricing.
  const [newCart, setNewCart] = useState<Record<string, number>>({});
  const setNewQty = (l: CatalogOrderLine, next: number) => {
    const cap = l.stock > 0 && l.stock < l.maxQty ? l.stock : l.maxQty;
    const clamped = Math.min(Math.max(Math.round(next) || 0, 0), Math.max(cap, 0));
    setNewCart((cur) => ({ ...cur, [lineKey(l)]: clamped }));
  };

  // Split picked lines: flagship (tier anchor) vs extra lines.
  const picked = catalogLines
    .map((l) => ({ line: l, qty: newCart[lineKey(l)] ?? 0 }))
    .filter((p) => p.qty > 0);
  const mainPicked = picked.filter((p) => p.line.productId === MAIN_PRODUCT_ID);
  const extraPicked = picked.filter((p) => p.line.productId !== MAIN_PRODUCT_ID);

  // Legacy-shaped values for the shared pricing pipeline (unchanged math):
  // qty = flagship pieces, colors = one variant id per flagship piece.
  const qty = mainPicked.reduce((s, p) => s + p.qty, 0);
  const colors = mainPicked.flatMap((p) =>
    Array<string>(p.qty).fill(p.line.variantId ?? p.line.productId)
  );
  const newLines = extraPicked.map((p) => ({
    id: p.line.productId,
    variantId: p.line.variantId,
    line: p.line,
    qty: p.qty,
  }));
  const newCount = newLines.reduce((s, l) => s + l.qty, 0);

  // UNIFORM PRICING: every piece costs the tier per-piece price for the
  // total piece count (settings table — server recompute uses the same rule).
  const allPieces = qty + newCount;
  const { perPiece } = priceForQty(productConfig, Math.max(allPieces, 1));
  const newTotal = perPiece * newCount;
  const pkgTotal = perPiece * qty;
  const pkgName = qty > 0 ? packageNameForQty(qty) : "এক্সট্রা প্রোডাক্ট";
  const freeShip = isFreeShipping(allPieces);

  // Combo strip data — live from admin tier config (never hardcoded).
  const tier1 = priceForQty(productConfig, 1);
  const tier2 = priceForQty(productConfig, 2);
  const tier3 = priceForQty(productConfig, 3);
  const comboCards = [
    { n: 1, perPiece: tier1.perPiece, total: tier1.total, save: 0, free: false },
    {
      n: 2,
      perPiece: tier2.perPiece,
      total: tier2.total,
      save: Math.max(tier1.perPiece * 2 - tier2.total, 0),
      free: isFreeShipping(2),
    },
    {
      n: 3,
      perPiece: tier3.perPiece,
      total: tier3.total,
      save: Math.max(tier1.perPiece * 3 - tier3.total, 0),
      free: isFreeShipping(3),
    },
  ];
  // Dynamic next-reward line under the strip.
  const progressLine =
    allPieces < 2
      ? `আরও ${toBn(2 - allPieces)}টি নিলে ${toBn(tier2.perPiece)}/পিস!`
      : allPieces < FREE_SHIPPING_MIN_QTY
        ? `আরও ${toBn(FREE_SHIPPING_MIN_QTY - allPieces)}টি নিলে ${toBn(tier3.perPiece)}/পিস + ডেলিভারি ফ্রি!`
        : "🎉 সেরা দাম + ফ্রি ডেলিভারি চালু!";
  const mainLabels = [...new Set(mainPicked.map((p) => p.line.variantLabel))];
  const firstPicked = picked.length > 0 ? picked[0].line : undefined;
  const previewImg = firstPicked?.image ?? staticLines()[0].image;

  const zoneNeeded = !isAllFree(deliveryConfig);
  const zoneObj = deliveryConfig.zones.find((z) => z.id === zone);
  const currentCharge = zoneNeeded ? (freeShip ? 0 : zoneCharge(deliveryConfig, zone)) : 0;
  const grandTotal = pkgTotal + newTotal + currentCharge;

  // Live savings vs single-piece price (+ delivery saved when free).
  const flagshipSave = Math.max(tier1.perPiece * qty - pkgTotal, 0);
  const normalDelivery = zoneNeeded && zone ? zoneCharge(deliveryConfig, zone) : 0;
  const totalSave = flagshipSave + (freeShip ? normalDelivery : 0);

  // Meta Pixel: InitiateCheckout fires once, on the user's first interaction with the order form
  const initiated = useRef(false);
  const fireInitiate = (price?: number) => {
    if (initiated.current) return;
    initiated.current = true;
    pixelTrack("InitiateCheckout", {
      value: price ?? grandTotal,
      currency: "BDT",
      content_name: "ঘুমপাড়া বেবি সোয়াডেল",
      content_ids: [
        ...skusForOrder(productConfig, qty, colors),
        ...newLines.map((l) => l.line.shopbaseSku).filter((s): s is string => !!s && s.length > 0),
      ],
    });
  };

  // Tap a combo card → select exactly the FIRST N lines (one piece each).
  // e.g. ৩টি = first three variants ×1. No-op when already exact.
  const quickSet = (n: number) => {
    const target = catalogLines.slice(0, Math.max(n, 0));
    const next: Record<string, number> = {};
    for (const l of target) next[lineKey(l)] = 1;
    setNewCart(next);
    fireInitiate();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Double-click guard: ignore re-submits while a request is in flight.
    if (loading) return;
    // Cart must not be empty.
    if (qty + newCount < 1) {
      toast({
        title: "পণ্য বেছে নিন",
        description: "অনুগ্রহ করে কমপক্ষে ১টি পণ্য বেছে নিন।",
        variant: "destructive",
      });
      return;
    }
    // Frontend BD-format gate: wrong number → no submit, clear Bangla message.
    if (!normalizeBdPhone(phone)) {
      toast({
        title: "সঠিক মোবাইল নম্বর দিন",
        description: `বাংলাদেশি ১১ ডিজিট নম্বর হতে হবে (যেমন: ${BD_PHONE_EXAMPLE})। 880 / +880 দিয়ে শুরু করলেও চলবে।`,
        variant: "destructive",
      });
      document.getElementById("phone")?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          ...location,
          colors,
          qty,
          zone,
          newItems: newLines.map((l) => ({ id: l.id, qty: l.qty, variantId: l.variantId })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data?.code === "duplicate") {
          setDuplicate({ orderCode: data.orderCode ?? "" });
          return;
        }
        toast({
          title: "অর্ডার সম্পন্ন হয়নি",
          description: data.error ?? "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }

      setSuccess({
        orderCode: data.orderCode,
        productPrice: data.productPrice,
        deliveryCharge: data.deliveryCharge,
        totalPrice: data.totalPrice,
      });
      // Meta Pixel: Purchase (COD order placed).
      // eventID = orderCode dedupes against the server Conversions API event.
      pixelTrack("Purchase", {
        value: data.totalPrice,
        currency: "BDT",
        content_name: "ঘুমপাড়া বেবি সোয়াডেল",
        content_ids: [
          ...skusForOrder(productConfig, qty, colors),
          ...newLines.map((l) => l.line.shopbaseSku).filter((s): s is string => !!s && s.length > 0),
        ],
        order_id: data.orderCode,
      }, data.orderCode);
      toast({
        title: "🎉 অর্ডার সফল হয়েছে!",
        description: "আমাদের প্রতিনিধি শীঘ্রই কল করে কনফার্ম করবেন।",
      });
      // Scroll success card into view
      setTimeout(() => {
        document.getElementById("order-success")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch {
      toast({
        title: "নেটওয়ার্ক সমস্যা",
        description: `ইন্টারনেট সংযোগ পরীক্ষা করুন অথবা সরাসরি ${HOTLINE} নম্বরে কল করুন।`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="order" className="relative scroll-mt-24 py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand-soft/80 via-cream to-cream" />
      </div>

      <div className="mx-auto max-w-4xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white">
            <ShoppingBag className="size-4" /> ক্যাশ অন ডেলিভারি
          </span>
          <h2 id="order-form" className="mt-4 scroll-mt-28 text-3xl font-bold text-ink sm:text-4xl">
            অর্ডার করুন — হাতে পেয়ে টাকা দিন
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            নিচের ফর্মটি পূরণ করুন — আমাদের প্রতিনিধি কল করে অর্ডার কনফার্ম করবেন, তারপর ১-৪ দিনের
            মধ্যে ডেলিভারি। কোনো অগ্রিম টাকা লাগবে না।
          </p>
        </div>

        <LiveCountBadge />

        {success ? (
          <div
            id="order-success"
            className="mx-auto mt-10 max-w-xl rounded-[2rem] border-2 border-leaf/40 bg-white p-8 text-center shadow-xl"
          >
            <CheckCircle2 className="mx-auto size-16 text-leaf" />
            <h3 className="mt-4 text-2xl font-bold text-ink">অর্ডার নিশ্চিত হয়েছে! 🎉</h3>
            <p className="mt-2 text-muted-foreground">
              আপনার অর্ডার কোড:{" "}
              <span className="font-bold text-brand">{success.orderCode}</span>
            </p>
            <div className="mt-3 rounded-2xl bg-cream p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">পণ্যের মূল্য</span>
                <span className="font-semibold text-ink">৳{toBn(success.productPrice)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                <span className={`font-semibold ${success.deliveryCharge > 0 ? "text-ink" : "text-leaf"}`}>
                  {success.deliveryCharge > 0 ? `৳${toBn(success.deliveryCharge)}` : "ফ্রি! 🎉"}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
                <span className="font-bold text-ink">সর্বমোট</span>
                <span className="font-bold text-brand">৳{toBn(success.totalPrice)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="group mx-auto mt-10 overflow-hidden rounded-[2rem] border border-border bg-white shadow-xl shadow-brand/10">
            <div className="grid lg:grid-cols-5">
              {/* Left: selected product preview — hover zoom */}
              <div className="relative hidden lg:col-span-2 lg:block">
                <div className="relative h-full min-h-[560px]">
                  <Image
                    src={previewImg}
                    alt="আপনার নির্বাচিত পণ্য"
                    fill
                    className="object-cover transition-transform duration-700 lg:group-hover:scale-105"
                    sizes="40vw"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-16">
                    <div className="text-white">
                      <div className="text-sm opacity-80">আপনার নির্বাচন</div>
                      <div className="text-lg font-bold">
                        {qty > 0
                          ? `${mainLabels.join(", ")} • ${pkgName}`
                          : firstPicked
                            ? `${firstPicked.name} (${firstPicked.variantLabel})`
                            : "পণ্য বেছে নিন"}
                        {newCount > 0 && qty > 0 ? ` + আরও ${toBn(newCount)}টি` : ""}
                      </div>
                      <div className="mt-1 text-2xl font-bold text-honey">
                        ৳{toBn(grandTotal)}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-white/85">
                        {toBn(allPieces)}টি পণ্য
                        {freeShip ? " • ডেলিভারি ফ্রি 🎉" : ""}
                        {totalSave > 0 ? ` • ৳${toBn(totalSave)} সাশ্রয়` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: form */}
              <div className="p-6 sm:p-8 lg:col-span-3">
                {/* Mobile product summary (lg:hidden) — mobile-first CRO */}
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-cream/60 p-3 lg:hidden">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border">
                    <Image src={previewImg} alt="নির্বাচিত পণ্য" fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">
                      {qty > 0
                        ? `${mainLabels.join(", ")} • ${pkgName}`
                        : firstPicked
                          ? `${firstPicked.name} (${firstPicked.variantLabel})`
                          : "পণ্য বেছে নিন"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {toBn(allPieces)}টি পণ্য • ডেলিভারি {freeShip ? "ফ্রি" : "চার্জ সহ"}
                      {totalSave > 0 ? ` • ৳${toBn(totalSave)} সাশ্রয়` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-bold text-brand">৳{toBn(grandTotal)}</div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Products — one row per variant, all from the catalog */}
                  <div>
                    <Label className="text-base font-bold text-ink">
                      ১. প্রোডাক্ট বেছে নিন{" "}
                      <span className="font-normal text-muted-foreground">
                        ({toBn(catalogLines.length)}টি অপশন)
                      </span>
                    </Label>
                    <p className="mt-1 text-xs font-semibold text-leaf">
                      💡 {progressLine}
                    </p>
                    {/* Combo strip — live tier prices, tap to quick-set flagship qty */}
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      {comboCards.map((c) => {
                        const active = c.n === 3 ? allPieces >= 3 : allPieces === c.n;
                        return (
                          <button
                            key={c.n}
                            type="button"
                            onClick={() => quickSet(c.n)}
                            aria-pressed={active}
                            aria-label={`${toBn(c.n)}টি${c.n === 3 ? "+" : ""} — মোট ৳${toBn(c.total)}`}
                            className={`rounded-2xl border-2 p-2 text-center transition-all ${
                              active
                                ? "border-brand bg-brand-soft/70 shadow-md shadow-brand/20"
                                : "border-border bg-white hover:border-honey/60"
                            }`}
                          >
                            <div className="text-sm font-bold text-ink">
                              {toBn(c.n)}টি{c.n === 3 ? "+" : ""}
                            </div>
                            <div className="text-sm font-bold text-brand">
                              ৳{toBn(c.perPiece)}/পিস
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              মোট ৳{toBn(c.total)}
                            </div>
                            {c.save > 0 ? (
                              <div className="mx-auto mt-1 w-fit rounded-full bg-leaf/15 px-2 py-0.5 text-[10px] font-bold text-leaf">
                                ৳{toBn(c.save)} ছাড়
                              </div>
                            ) : null}
                            {c.free ? (
                              <div className="mx-auto mt-1 w-fit rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                                ফ্রি ডেলিভারি
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      যেকোনো প্রোডাক্ট মিলিয়ে — মোট সংখ্যায় ছাড় প্রযোজ্য
                    </p>
                    <div className="mt-2.5 space-y-2.5">
                      {catalogLines.map((l) => {
                        const key = lineKey(l);
                        const nq = newCart[key] ?? 0;
                        const cap = l.stock > 0 && l.stock < l.maxQty ? l.stock : l.maxQty;
                        const lowStock = l.stock > 0 && l.stock <= 10;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2.5"
                          >
                            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                              <Image
                                src={l.image}
                                alt={`${l.name} (${l.variantLabel})`}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                              {lowStock ? (
                                <span className="absolute bottom-0 inset-x-0 bg-rust/90 px-1 py-0.5 text-center text-[9px] font-bold text-white">
                                  {toBn(l.stock)}টা বাকি
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-ink">
                                {l.name} ({l.variantLabel}){" "}
                                {l.featured ? (
                                  <span className="ml-1 rounded-full bg-honey px-2 py-0.5 text-[10px] font-bold text-ink">
                                    ⭐ ফিচার্ড
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-sm">
                                <span className="font-bold text-brand">৳{toBn(perPiece)}</span>{" "}
                                <span className="text-xs text-muted-foreground line-through">
                                  ৳{toBn(l.oldPrice)}
                                </span>
                              </div>
                              {lowStock ? (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-rust">
                                  <Flame className="size-3" /> শুধু {toBn(l.stock)}টা বাকি —
                                  দ্রুত অর্ডার করুন!
                                </div>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`${l.variantLabel} কমান`}
                                onClick={() => {
                                  setNewQty(l, nq - 1);
                                  fireInitiate();
                                }}
                                disabled={nq <= 0}
                                className="grid size-9 place-items-center rounded-full border-2 border-border text-lg font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="min-w-6 text-center text-base font-bold text-ink">
                                {toBn(nq)}
                              </span>
                              <button
                                type="button"
                                aria-label={`${l.variantLabel} বাড়ান`}
                                onClick={() => {
                                  setNewQty(l, nq + 1);
                                  fireInitiate();
                                }}
                                disabled={nq >= cap}
                                className="grid size-9 place-items-center rounded-full border-2 border-border text-lg font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="space-y-4">
                    <Label className="text-base font-bold text-ink">২. ডেলিভারির তথ্য</Label>
                    <div>
                      <Label htmlFor="name" className="text-sm text-muted-foreground">
                        আপনার নাম *
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          fireInitiate();
                        }}
                        placeholder="যেমন: আয়েশা সিদ্দিকা"
                        required
                        className="mt-1.5 h-12 rounded-xl border-border bg-cream/60 focus-visible:ring-brand"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-sm text-muted-foreground">
                        মোবাইল নম্বর *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => {
                          setPhone(autoFormatBdPhone(e.target.value));
                          fireInitiate();
                        }}
                        placeholder="01XXXXXXXXX"
                        required
                        className="mt-1.5 h-12 rounded-xl border-border bg-cream/60 focus-visible:ring-brand"
                      />
                      {phone.trim() !== "" && !normalizeBdPhone(phone) ? (
                        <p className="mt-1 text-xs font-semibold text-destructive">
                          ⚠️ সঠিক বাংলাদেশি নম্বর দিন (যেমন: {BD_PHONE_EXAMPLE}) — ভুল নম্বরে অর্ডার সাবমিট হবে না।
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          01 দিয়ে ১১ ডিজিট — 880/+880 সহ দিলেও চলবে।
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="address" className="text-sm text-muted-foreground">
                        সম্পূর্ণ ঠিকানা *
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          fireInitiate();
                        }}
                        placeholder="বাসা/হোল্ডিং, রোড, এলাকা, থানা, জেলা"
                        required
                        rows={2}
                        className="mt-1.5 rounded-xl border-border bg-cream/60 focus-visible:ring-brand"
                      />
                    </div>
                  </div>

                  {/* Location cascade: Division → District → Upazila */}
                  {locationEnabled && (
                    <AddressCascade
                      value={location}
                      onChange={(v) => {
                        setLocation(v);
                        fireInitiate();
                      }}
                      title="৩. আপনার এলাকা নির্বাচন করুন"
                    />
                  )}

                  {/* Delivery zone selection (only when charges apply) */}
                  {zoneNeeded && (
                    <div>
                      <Label className="text-base font-bold text-ink">{locationEnabled ? "৪" : "৩"}. ডেলিভারি এলাকা নির্বাচন করুন</Label>
                      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                        {deliveryConfig.zones.map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => {
                              setZone(z.id);
                              fireInitiate();
                            }}
                            aria-pressed={zone === z.id}
                            className={`flex items-center justify-between rounded-2xl border-2 p-3.5 text-left transition-all ${
                              zone === z.id
                                ? "border-brand bg-brand-soft/60"
                                : "border-border hover:border-honey/50"
                            }`}
                          >
                            <span className="text-sm font-bold text-ink">{z.label}</span>
                            <span
                              className={`text-sm font-bold ${z.charge > 0 && !freeShip ? "text-brand" : "text-leaf"}`}
                            >
                              {z.charge > 0 && !freeShip ? `৳${toBn(z.charge)}` : "ফ্রি"}
                            </span>
                          </button>
                        ))}
                      </div>
                      {zoneObj?.note ? (
                        <p className="mt-1.5 rounded-lg bg-honey/10 px-3 py-1.5 text-xs font-medium text-ink">
                          📝 {zoneObj.note}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ডেলিভারি চার্জ পণ্যের দামের সাথে যোগ হবে — হাতে পেয়ে কুরিয়ার প্রতিনিধিকে মোট টাকা দিন।
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="rounded-2xl bg-cream p-4">
                    {qty > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {pkgName} ({mainLabels.join(", ")}
                          {qty > 1 ? ` +${toBn(qty - 1)}` : ""}) — ৳{toBn(perPiece)}/পিস
                        </span>
                        <span className="font-semibold text-ink">৳{toBn(pkgTotal)}</span>
                      </div>
                    )}
                    {newLines.map((l) => (
                      <div key={lineKey(l.line)} className="mt-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {l.line.name} ({l.line.variantLabel}) ×{toBn(l.qty)}
                        </span>
                        <span className="font-semibold text-ink">৳{toBn(perPiece * l.qty)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                      <span className={`font-semibold ${currentCharge > 0 ? "text-ink" : "text-leaf"}`}>
                        {currentCharge > 0 ? `৳${toBn(currentCharge)}` : "ফ্রি! 🎉"}
                      </span>
                    </div>
                    {totalSave > 0 ? (
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="font-bold text-leaf">🎉 মোট সাশ্রয়</span>
                        <span className="font-bold text-leaf">৳{toBn(totalSave)}</span>
                      </div>
                    ) : null}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
                      <span className="font-bold text-ink">সর্বমোট</span>
                      <span className="font-bold text-brand">৳{toBn(grandTotal)}</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-14 w-full rounded-full bg-brand text-lg font-bold text-white shadow-xl shadow-brand/30 hover:bg-brand-deep disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" /> অর্ডার প্রসেস হচ্ছে...
                      </>
                    ) : (
                      "অর্ডার কনফার্ম করুন — ৳" + toBn(grandTotal)
                    )}
                  </Button>

                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3.5 text-leaf" /> ১০০% নিরাপদ অর্ডার
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="size-3.5 text-leaf" /> {isAllFree(deliveryConfig) ? "ফ্রি ডেলিভারি সারা দেশে" : "সারা দেশে হোম ডেলিভারি"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5 text-leaf" /> হেল্পলাইন: {HOTLINE}
                    </span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate-order popup: already ordered within 24h */}
      {duplicate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ডুপ্লিকেট অর্ডার"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setDuplicate(null)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">⏳</div>
            <h3 className="mt-3 text-xl font-bold text-ink">
              আপনি ইতিমধ্যে অর্ডার করেছেন
            </h3>
            {duplicate.orderCode ? (
              <p className="mt-1 text-sm text-muted-foreground">
                অর্ডার কোড: <span className="font-mono font-bold text-brand">{duplicate.orderCode}</span>
              </p>
            ) : null}
            <p className="mt-3 rounded-2xl bg-cream p-4 text-sm leading-relaxed text-ink">
              আপনি একবার অর্ডার করেছেন — ভুলে দুবার চাপ পড়ে গেছে মনে হচ্ছে।
              আবার অর্ডার করতে হলে <b>২৪ ঘণ্টা</b> অপেক্ষা করুন — আমাদের
              প্রতিনিধি এর মধ্যেই কল করে কনফার্ম করবেন।
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              WhatsApp-এ অর্ডার করতে চাইলে আমাদের WhatsApp নম্বরে ({WHATSAPP_DISPLAY}) যোগাযোগ করুন।
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                `আসসালামু আলাইকুম! আমি অর্ডার করেছি${duplicate.orderCode ? ` (কোড: ${duplicate.orderCode})` : ""} — এ বিষয়ে কথা বলতে চাই।`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#128C4B] py-3.5 text-base font-bold text-white hover:opacity-90"
            >
              WhatsApp-এ অর্ডার করুন
            </a>
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="mt-2.5 h-12 w-full rounded-full border-2 border-border text-base font-bold text-ink hover:border-brand"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
