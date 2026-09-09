"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_COLORS, toBn, HOTLINE, HOTLINE_LINK } from "@/lib/landing-data";
import { zoneCharge, isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import { PACKAGE_META, getPackage, perPiecePrice, type ProductConfig } from "@/lib/product-shared";
import type { LocationSelection } from "@/lib/bd-geo";
import { AddressCascade } from "@/components/landing/address-cascade";
import { pixelTrack } from "@/lib/pixel";
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
  const [mult, setMult] = useState<number>(1);
  const [customQty, setCustomQty] = useState<number>(4);
  const [colors, setColors] = useState<string[]>(["pink"]);
  const [pkg, setPkg] = useState<string>(
    productConfig.packages.some((p) => p.id === "combo2")
      ? "combo2"
      : (productConfig.packages[0]?.id ?? "combo2")
  );
  const [zone, setZone] = useState<string>(deliveryConfig.zones[0]?.id ?? "");
  const [location, setLocation] = useState<LocationSelection>({
    division: "",
    district: "",
    upazila: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{
    orderCode: string;
    productPrice: number;
    deliveryCharge: number;
    totalPrice: number;
  } | null>(null);

  // Package options always follow the admin-configured prices.
  const packageOptions = productConfig.packages.map((p) => {
    const meta = PACKAGE_META[p.id];
    return {
      id: p.id,
      name: meta.formName,
      price: p.price,
      unit: `৳${toBn(perPiecePrice({ price: p.price, quantity: meta.quantity }))}/পিস${meta.unitSuffix}`,
    };
  });

  const selectedPkg = packageOptions.find((p) => p.id === pkg) ?? packageOptions[0];
  const selectedQty = getPackage(productConfig, selectedPkg.id)?.quantity ?? 1;
  const isCustom = selectedPkg.id === "custom";
  const totalItems = isCustom ? customQty : selectedQty * mult;
  const pkgTotal = isCustom ? selectedPkg.price * customQty : selectedPkg.price * mult;
  const firstColor = PRODUCT_COLORS.find((c) => c.id === colors[0]) ?? PRODUCT_COLORS[1];

  // Keep exactly one color slot per item when package/multiplier changes
  useEffect(() => {
    setColors((cur) => {
      if (cur.length === totalItems) return cur;
      if (cur.length > totalItems) return cur.slice(0, totalItems);
      return [...cur, ...Array<string>(totalItems - cur.length).fill("pink")];
    });
  }, [totalItems]);

  const zoneNeeded = !isAllFree(deliveryConfig);
  const currentCharge = zoneNeeded ? zoneCharge(deliveryConfig, zone) : 0;
  const grandTotal = pkgTotal + currentCharge;

  // Meta Pixel: InitiateCheckout fires once, on the user's first interaction with the order form
  const initiated = useRef(false);
  const fireInitiate = (price?: number) => {
    if (initiated.current) return;
    initiated.current = true;
    pixelTrack("InitiateCheckout", {
      value: (price ?? selectedPkg.price) + currentCharge,
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
        body: JSON.stringify({ name, phone, address, ...location, colors, multiplier: mult, customQty, pkg, zone }),
      });
      const data = await res.json();

      if (!res.ok) {
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
      // Meta Pixel: Purchase (COD order placed)
      pixelTrack("Purchase", {
        value: data.totalPrice,
        currency: "BDT",
        content_name: "ঘুমপাড়া বেবি সোয়াডেল",
        order_id: data.orderCode,
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
                          {firstColor.label} • {selectedPkg.name}
                        </div>
                      <div className="mt-1 text-2xl font-bold text-honey">
                        ৳{toBn(selectedPkg.price)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: form */}
              <div className="p-6 sm:p-8 lg:col-span-3">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Package selection */}
                  <div>
                    <Label className="text-base font-bold text-ink">১. প্যাকেজ নির্বাচন করুন</Label>
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {packageOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                            onClick={() => {
                              setPkg(p.id);
                              fireInitiate(
                                p.id === "custom" ? p.price * customQty : p.price * mult
                              );
                            }}
                          aria-pressed={pkg === p.id}
                          className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                            pkg === p.id
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

                  {/* Quantity multiplier / custom piece count */}
                  {isCustom ? (
                    <div className="mt-5">
                      <Label className="text-base font-bold text-ink">পিস সংখ্যা</Label>
                      <div className="mt-2.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setCustomQty((n) => Math.max(1, n - 1))}
                          disabled={customQty <= 1}
                          aria-label="সংখ্যা কমান"
                          className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="min-w-20 text-center text-lg font-bold text-ink">
                          {toBn(customQty)}টি{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            (৳{toBn(selectedPkg.price)}/পিস)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomQty((n) => Math.min(30, n + 1))}
                          disabled={customQty >= 30}
                          aria-label="সংখ্যা বাড়ান"
                          className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        যত পিস চান তত নিন — দাম প্রতি-পিস রেটে হিসাব হবে।
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <Label className="text-base font-bold text-ink">পরিমাণ</Label>
                      <div className="mt-2.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setMult((m) => Math.max(1, m - 1))}
                          disabled={mult <= 1}
                          aria-label="পরিমাণ কমান"
                          className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="min-w-20 text-center text-lg font-bold text-ink">
                          {toBn(mult)}×{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({toBn(totalItems)}টি)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setMult((m) => Math.min(10, m + 1))}
                          disabled={mult >= 10}
                          aria-label="পরিমাণ বাড়ান"
                          className="grid size-11 place-items-center rounded-full border-2 border-border text-xl font-bold text-ink transition-all hover:border-brand disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        একই প্যাকেজ একাধিক সেট নিলে দাম প্যাকেজ দামের গুণিতক হবে।
                      </p>
                    </div>
                  )}

                  {/* Color selection — one picker per item */}
                  <div>
                    <Label className="text-base font-bold text-ink">
                      ২. কালার বেছে নিন
                      {totalItems > 1 ? ` (${toBn(totalItems)}টি পিসের জন্য ${toBn(totalItems)}টি কালার)` : ""}
                    </Label>
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
                              className={`text-sm font-bold ${z.charge > 0 ? "text-brand" : "text-leaf"}`}
                            >
                              {z.charge > 0 ? `৳${toBn(z.charge)}` : "ফ্রি"}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ডেলিভারি চার্জ পণ্যের দামের সাথে যোগ হবে — হাতে পেয়ে কুরিয়ার প্রতিনিধিকে মোট টাকা দিন।
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="rounded-2xl bg-cream p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedPkg.name}
                        {!isCustom && mult > 1 ? ` ×${toBn(mult)}` : ""} ({firstColor.label}
                        {totalItems > 1 ? ` +${toBn(totalItems - 1)}` : ""})
                      </span>
                      <span className="font-semibold text-ink">৳{toBn(pkgTotal)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                      <span className={`font-semibold ${currentCharge > 0 ? "text-ink" : "text-leaf"}`}>
                        {currentCharge > 0 ? `৳${toBn(currentCharge)}` : "ফ্রি!"}
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
    </section>
  );
}
