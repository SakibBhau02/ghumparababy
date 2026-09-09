import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toBn } from "@/lib/landing-data";
import type { ProductConfig } from "@/lib/product-shared";
import { priceForQty } from "@/lib/product-shared";
import { isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import { ShieldCheck, Truck, BadgeCheck, Star, ChevronDown } from "lucide-react";

export function Hero({
  deliveryConfig,
  productConfig,
}: {
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
}) {
  const singlePrice = priceForQty(productConfig, 1).total;
  const free = isAllFree(deliveryConfig);
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      {/* soft background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-24 size-96 rounded-full bg-brand-soft blur-3xl opacity-70" />
        <div className="absolute top-40 -right-24 size-80 rounded-full bg-honey/20 blur-3xl opacity-60" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 lg:grid-cols-2 lg:gap-6">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <Badge className="mb-4 rounded-full bg-leaf/15 px-4 py-1.5 text-sm text-leaf border-0">
            🇧🇩 ৫,০০০+ বাংলাদেশি মা-বাবার আস্থার পছন্দ
          </Badge>

          <h1 className="text-3xl font-bold leading-[1.25] text-ink sm:text-4xl lg:text-[2.75rem]">
            রাতবেরাত চমকে ওঠা, কাঁদা আর ঘুম না হওয়ার{" "}
            <span className="relative inline-block text-brand">
              আসল কারণ
              <svg
                className="absolute -bottom-1 left-0 w-full"
                viewBox="0 0 200 9"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 7C50 2 150 2 198 6"
                  stroke="#E9A23B"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            — মোরো রিফ্লেক্স!
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
            আপনার নবজাতক <b className="text-foreground">ভয়ে চমকে ওঠে</b>, হাত-পা ছড়িয়ে কাঁদে — এটাই{" "}
            <b className="text-foreground">মোরো রিফ্লেক্স</b>, যা প্রতি ১০ বাচ্চার প্রত্যেকেরই থাকে।{" "}
            <b className="text-brand">ঘুমপাড়া সোয়াডেল</b> বাচ্চাকে জড়িয়ে ধরে মায়ের গর্ভের মতো নিরাপদ
            অনুভূতি দেয় — হঠাৎ চমকে ওঠা কমিয়ে <b className="text-foreground">গভীর, টানা ঘুম</b> নিশ্চিত
            করে।
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-leaf" /> মোরো রিফ্লেক্স প্রিভেনশন
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-leaf" /> শীতের ঠান্ডা-কাশি থেকে সুরক্ষা
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="size-4 fill-honey text-honey" /> ৪.৯/৫ রেটিং
            </span>
          </div>

          {/* Price + CTA */}
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-brand">৳{toBn(singlePrice)}</span>
              <span className="text-xl text-muted-foreground line-through">৳{toBn(899)}</span>
              <span className="rounded-full bg-rust/10 px-3 py-1 text-sm font-semibold text-rust">
                {toBn(39)}% ছাড়
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a href="#order" className="sm:flex-1 lg:flex-none">
              <Button
                size="lg"
                className="animate-gentle-pulse w-full rounded-full bg-brand px-10 py-6 text-lg font-bold text-white shadow-xl shadow-brand/30 hover:bg-brand-deep sm:w-auto"
              >
                অর্ডার করুন — ক্যাশ অন ডেলিভারি
              </Button>
            </a>
            <a href="#moro">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-2 border-brand/30 px-6 py-6 font-semibold text-brand hover:bg-brand-soft sm:w-auto"
              >
                মোরো রিফ্লেক্স কী? <ChevronDown className="size-4" />
              </Button>
            </a>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            ✓ অগ্রিম পেমেন্ট লাগবে না — পণ্য হাতে পেয়ে টাকা দিন ✓ {free ? "সারা দেশে ফ্রি ডেলিভারি" : "সারা দেশে হোম ডেলিভারি"}
          </p>
        </div>

        {/* Image */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-8 border-white shadow-2xl shadow-brand/20">
            <Image
              src="/images/swaddle-blue.jpg"
              alt="ঘুমপাড়া সোয়াডেল পরা নবজাতক — গভীর ঘুমে নিরাপদ"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 90vw, 45vw"
            />
            <div className="absolute right-4 top-4 rounded-full bg-white/95 px-4 py-1.5 text-sm font-bold text-ink shadow">
              নতুন প্যারেন্টদের ১ নম্বর পছন্দ
            </div>
          </div>

          {/* floating cards */}
          <div className="animate-float-soft absolute left-4 top-6 rounded-2xl bg-white p-3 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">😴</span>
              <div>
                <div className="text-sm font-bold text-ink">টানা ৫-৬ ঘণ্টা</div>
                <div className="text-xs text-muted-foreground">গভীর ঘুমের অভিজ্ঞতা</div>
              </div>
            </div>
          </div>
          <div className="animate-float-soft absolute bottom-10 right-4 rounded-2xl bg-white p-3 shadow-xl" style={{ animationDelay: "1.2s" }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">🛡️</span>
              <div>
                <div className="text-sm font-bold text-ink">চমকে ওঠা কমায়</div>
                <div className="text-xs text-muted-foreground">মোরো রিফ্লেক্স প্রিভেনশন</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="mx-auto mt-6 max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-md sm:grid-cols-4">
          {[
            { icon: Truck, title: free ? "ফ্রি হোম ডেলিভারি" : "হোম ডেলিভারি", sub: "সারা বাংলাদেশে" },
            { icon: ShieldCheck, title: "ক্যাশ অন ডেলিভারি", sub: "হাতে পেয়ে টাকা দিন" },
            { icon: BadgeCheck, title: "১০০% প্রিমিয়াম কোয়ালিটি", sub: "স্কিন-ফ্রেন্ডলি ফ্লিস" },
            { icon: Star, title: "৫,০০০+ ভেরিফাইড রিভিউ", sub: "গড় রেটিং ৪.৯/৫" },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3 rounded-2xl px-2 py-2">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                <item.icon className="size-5 text-brand" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-ink">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
