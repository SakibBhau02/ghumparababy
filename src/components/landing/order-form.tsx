"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_COLORS, toBn, HOTLINE, HOTLINE_LINK, WHATSAPP_NUMBER } from "@/lib/landing-data";
import { BD_PHONE_EXAMPLE, normalizeBdPhone } from "@/lib/phone-shared";
import { zoneCharge, isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import {
  MAX_QTY,
  PACKAGE_META,
  isFreeShipping,
  packageNameForQty,
  priceForQty,
  type ProductConfig,
} from "@/lib/product-shared";
import type { LocationSelection } from "@/lib/bd-geo";
import { AddressCascade } from "@/components/landing/address-cascade";
import { pixelTrack } from "@/lib/pixel";
import { pushViewItem, pushPurchase } from "@/lib/gtm-data-layer";
import { CheckCircle2, Loader2, Phone, ShieldCheck, Truck, ShoppingBag } from "lucide-react";

export function OrderForm({
  deliveryConfig,
  productConfig,
  locationEnabled,
}: {
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
  locationEnabled: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  // Quantity stepper (1..MAX_QTY). 1/2/3 quick-select presets set exact qty;
  // per-piece price falls automatically as qty grows (volume tiers).
  const [qty, setQty] = useState<number>(2);
  const [colors, setColors] = useState<string[]>(["pink", "pink"]);
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

  // Package quick-select presets (1/2/3 pcs) + per-piece tiers.
  const packageOptions = productConfig.packages.map((p) => {
    const meta = PACKAGE_META[p.id];
    const preset = priceForQty(productConfig, meta.quantity);
    return {
      id: p.id,
      name: meta.formName,
      qtyPreset: meta.quantity,
      price: preset.total,
      unit: `৳${toBn(preset.perPiece)}/পিস${meta.unitSuffix}`,
    };
  });

  const totalItems = qty;
  const { perPiece, total: pkgTotal } = priceForQty(productConfig, qty);
  const pkgName = packageNameForQty(qty);
  const freeShip = isFreeShipping(qty);
  const firstColor = PRODUCT_COLORS.find((c) => c.id === colors[0]) ?? PRODUCT_COLORS[1];

  // GTM: view_item on mount
  useEffect(() => {
    pushViewItem({
      item_id: "ghumparababy-swaddle",
      item_name: "ঘুমপাড়া বেবি সোয়াডেল",
      price: pkgTotal,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep exactly one color slot per item when quantity changes.
  // New slots copy the FIRST chosen color (not a fixed default) — most
  // buyers want matching pieces, so the machine does it for them (Tesler).
  useEffect(() => {
    setColors((cur) => {
      if (cur.length === totalItems) return cur;
      if (cur.length > totalItems) return cur.slice(0, totalItems);
      const fill = cur[0] ?? "pink";
      return [...cur, ...Array<string>(totalItems - cur.length).fill(fill)];
    });
  }, [totalItems]);

  const zoneNeeded = !isAllFree(deliveryConfig);
  const zoneObj = deliveryConfig.zones.find((z) => z.id === zone);
  const currentCharge = zoneNeeded ? (freeShip ? 0 : zoneCharge(deliveryConfig, zone)) : 0;
  const grandTotal = pkgTotal + currentCharge;

  // Meta Pixel: InitiateCheckout fires once, on the user's first interaction with the order form
  const initiated = useRef(false);
  const fireInitiate = (price?: number) => {
    if (initiated.current) return;
    initiated.current = true;
    pixelTrack("InitiateCheckout", {
      value: (price ?? pkgTotal) + currentCharge,
      currency: "BDT",
      content_name: "ঘুমপাড়া বেবি সোয়াডেল",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, ...location, colors, qty, zone }),
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
        order_id: data.orderCode,
      }, data.orderCode);
      // GTM: purchase event
      pushPurchase({
        transaction_id: data.orderCode,
        value: data.totalPrice,
        items: [
          {
            item_id: "ghumparababy-swaddle",
            item_name: "ঘুমপাড়া বেবি সোয়াডেল",
            price: perPiece,
            quantity: qty,
          },
        ],
      });
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
                  {success.deliveryCharge > 0 ? `৳${toBn(success.deliveryCharge)}` : "ফ্রি!"}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="font-bold text-ink">সর্বমোট (ক্যাশ অন ডেলিভারি)</span>
                <span className="font-bold text-brand">৳{toBn(success.totalPrice)}</span>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-leaf/10 p-4 text-sm text-ink">
              আমাদের প্রতিনিধি ২৪ ঘণ্টার মধ্যে কল করে অর্ডার কনফার্ম করবেন। পণ্য হাতে পেয়ে টাকা
              দিন। যেকোনো প্রশ্নে কল করুন:{" "}
              <a href={HOTLINE_LINK} className="font-bold text-brand">
                {HOTLINE}
              </a>
            </p>
          </div>
        ) : (
          <div className="mt-10 overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-brand/10">
            <div className="grid lg:grid-cols-5">
              {/* Left: selected product preview */}
              <div className="relative hidden lg:col-span-2 lg:block">
                <div className="relative h-full min-h-[560px]">
                    <Image
                      src={firstColor.image}
                      alt={`${firstColor.label} কালারের সোয়াডেল`}
                    fill
                    className="object-cover"
                    sizes="40vw"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-16">
                    <div className="text-white">
                      <div className="text-sm opacity-80">আপনার নির্বাচন</div>
                        <div className="text-lg font-bold">
                          {firstColor.label} • {pkgName}
                        </div>
                      <div className="mt-1 text-2xl font-bold text-honey">
                        ৳{toBn(pkgTotal)}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-white/85">
                        ৳{toBn(perPiece)}/পিস • {toBn(totalItems)}টি
                        {freeShip ? " • ডেলিভারি ফ্রি 🎉" : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: form */}
              <div className="p-6 sm:p-8 lg:col-span-3">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Package quick-select (1/2/3 pcs) — fine-tune below one by one */}
                  <div>
                    <Label className="text-base font-bold text-ink">১. প্যাকেজ নির্বাচন করুন</Label>
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                      {packageOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                            onClick={() => {
                              setQty(p.qtyPreset);
                              fireInitiate(p.price);
                            }}
                          aria-pressed={qty === p.qtyPreset}
                          className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                            qty === p.qtyPreset
                              ? "border-brand bg-brand-soft/60"
                              : "border-border hover:border-honey/50"
                          }`}
                        >
                          <div className="text-sm font-bold text-ink">{p.name}</div>
                          <div className="mt-0.5 text-base font-bold text-brand">
                            ৳{toBn(p.price)}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                            {p.unit}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity stepper — one by one, cheaper per piece as qty grows */}
                  <div className="mt-5">
                    <Label className="text-base font-bold text-ink">
                      পরিমাণ — একটা একটা করে বাড়ান, প্রতি পিস সস্তা হবে
                    </Label>
                    <div className="mt-2.5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQty((n) => Math.max(1, n - 1))}
                        disabled={qty <= 1}
                        aria-label="সংখ্যা কমান"
                        className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="min-w-20 text-center text-lg font-bold text-ink">
                        {toBn(qty)}টি{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          (৳{toBn(perPiece)}/পিস)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))}
                        disabled={qty >= MAX_QTY}
                        aria-label="সংখ্যা বাড়ান"
                        className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-leaf">
                      {freeShip
                        ? "🎉 ৩+ পিসে ডেলিভারি সম্পূর্ণ ফ্রি!"
                        : `আরও ${toBn(3 - qty)}টি নিলে ডেলিভারি ফ্রি!`}
                    </p>
                  </div>

                  {/* Color selection — one picker per item */}
                  <div>
                    <Label className="text-base font-bold text-ink">
                      ২. কালার বেছে নিন
                      {totalItems > 1 ? ` (${toBn(totalItems)}টি পিসের জন্য ${toBn(totalItems)}টি কালার)` : ""}
                    </Label>
                    {/* One-tap: paint every piece the same color, then tweak individuals */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-2xl bg-cream p-3">
                      <span className="text-xs font-bold text-ink">সবগুলো একসাথে:</span>
                      {PRODUCT_COLORS.map((c) => {
                        const allThis = colors.length > 0 && colors.every((v) => v === c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setColors(Array<string>(totalItems).fill(c.id));
                              fireInitiate();
                            }}
                            aria-pressed={allThis}
                            aria-label={`সবগুলো ${c.label}`}
                            title={`সবগুলো ${c.label}`}
                            className={`flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-2.5 transition-all ${
                              allThis ? "border-brand bg-brand-soft/60" : "border-border bg-white hover:border-honey/60"
                            }`}
                          >
                            <span
                              className="inline-block size-5 rounded-full border border-black/20"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className={`text-xs font-semibold ${allThis ? "text-brand" : "text-muted-foreground"}`}>
                              {c.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 space-y-4">
                      {colors.map((col, i) => (
                        <div key={i}>
                          {totalItems > 1 && (
                            <div className="mb-1.5 text-sm font-semibold text-ink">
                              {toBn(i + 1)} নম্বর পিস
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                            {PRODUCT_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setColors((cur) => cur.map((v, j) => (j === i ? c.id : v)));
                                  fireInitiate();
                                }}
                                aria-pressed={col === c.id}
                                aria-label={c.label}
                                className={`group flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all ${
                                  col === c.id ? "border-brand bg-brand-soft/50" : "border-transparent"
                                }`}
                              >
                                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                                  <Image src={c.image} alt={c.label} fill className="object-cover" sizes="60px" />
                                </div>
                                <span className={`text-xs font-medium ${col === c.id ? "text-brand" : "text-muted-foreground"}`}>
                                  {c.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="space-y-4">
                    <Label className="text-base font-bold text-ink">৩. ডেলিভারির তথ্য</Label>
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
                          setPhone(e.target.value);
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
                    />
                  )}

                  {/* Delivery zone selection (only when charges apply) */}
                  {zoneNeeded && (
                    <div>
                      <Label className="text-base font-bold text-ink">{locationEnabled ? "৫" : "৪"}. ডেলিভারি এলাকা নির্বাচন করুন</Label>
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
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {pkgName} ({firstColor.label}
                        {totalItems > 1 ? ` +${toBn(totalItems - 1)}` : ""}) — ৳{toBn(perPiece)}/পিস
                      </span>
                      <span className="font-semibold text-ink">৳{toBn(pkgTotal)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                      <span className={`font-semibold ${currentCharge > 0 ? "text-ink" : "text-leaf"}`}>
                        {currentCharge > 0 ? `৳${toBn(currentCharge)}` : "ফ্রি! 🎉"}
                      </span>
                    </div>
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
              ভুলে দুবার চাপ পড়ে গেছে মনে হচ্ছে। আবার অর্ডার করতে হলে{" "}
              <b>২৪ ঘণ্টা</b> অপেক্ষা করুন — আমাদের প্রতিনিধি এর মধ্যেই কল করে
              কনফার্ম করবেন।
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
