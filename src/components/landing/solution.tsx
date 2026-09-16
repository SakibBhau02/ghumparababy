import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { ProductConfig } from "@/lib/product-shared";
import { priceForQty } from "@/lib/product-shared";
import { siteImage } from "@/lib/site-images";
import { isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import { ShieldCheck, Snowflake, BedDouble, Droplets, Feather, HeartHandshake } from "lucide-react";

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "মোরো রিফ্লেক্স প্রিভেনশন",
    desc: "কোমলভাবে জড়িয়ে রাখায় বাচ্চার হাত-পা নিয়ন্ত্রণে থাকে, ভারসাম্য হারানোর “পড়ে যাচ্ছি” অনুভূতি তৈরি হয় না — ফলে চমকে ওঠার রিয়েকশন ট্রিগারই হয় না। গবেষণায় দেখা গেছে swaddled শিশু দীর্ঘক্ষণ quiet sleep-এ থাকে, হঠাৎ জেগে ওঠা অনেক কম (NIH, 2022)।",
    highlight: true,
  },
  {
    icon: Snowflake,
    title: "শীতের ঠান্ডা থেকে পূর্ণ সুরক্ষা",
    desc: "প্রিমিয়াম মল্টি-ফ্লিস বুক-পেট-পা উষ্ণ রাখে। কম্বল খুলে যাওয়ার ভয় নেই — ঘুমন্ত অবস্থাতেও সারা রাত উষ্ণ থাকে, ঠান্ডা-লাগা ও কাশির ঝুঁকি কমে।",
  },
  {
    icon: BedDouble,
    title: "গর্ভের মতো নিরাপদ অনুভূতি",
    desc: "মায়ের গর্ভের আঁটসাঁট, উষ্ণ পরিবেশের মতো অনুভূতি দেয় — জন্মের পর পৃথিবীতে মানিয়ে নেওয়া সহজ হয়, বাচ্চা দ্রুত ও শান্তভাবে ঘুমিয়ে পড়ে।",
  },
  {
    icon: Feather,
    title: "উষ্ণ অথচ নিঃশ্বাসের মতো নরম",
    desc: "বাইরে মখমলের মতো নরম ফ্লিস, ভেতরে কোমল কটন লাইনিং — বাচ্চার স্পর্শকাতর ত্বকে ঘাম জমে না, জ্বালা করে না।",
  },
  {
    icon: Droplets,
    title: "সহজে ধোয়া যায়",
    desc: "মেশিন ওয়াশেবল — বারবার ধুলেও রং ও নরমতা নষ্ট হয় না। নিরাপদে ড্রায়ারে শুকানো যায়।",
  },
  {
    icon: HeartHandshake,
    title: "মায়ের হাতের বোঝা কমায়",
    desc: "বাচ্চা টানা ঘুমালে মাও ঘুমাতে পারেন। কোলে নেওয়া, ফিডিং, স্ট্রলারে ঘোরানো — সব জায়গায় কাজে লাগে। মায়ের ক্লান্তি কমে, মন ভালো থাকে।",
  },
];

export function Solution({
  deliveryConfig,
  productConfig,
  solutionImage,
}: {
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
  solutionImage?: string;
}) {
  const singlePrice = priceForQty(productConfig, 1).total;
  const img = solutionImage || siteImage("/images/swaddle-brown.jpg");
  return (
    <section id="solution" className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-leaf/15 px-4 py-1.5 text-sm font-semibold text-leaf">
            ✓ গবেষণা-সমর্থিত সমাধান
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-ink sm:text-4xl">
            একটি সোয়াডেল = <span className="text-brand">গভীর ঘুম</span> +{" "}
            <span className="text-brand">শীত সুরক্ষা</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <b className="text-foreground">ঘুমপাড়া সোয়াডেল</b> শুধু শীতের পোশাক নয় — এটি বিজ্ঞানসম্মতভাবে
            ডিজাইন করা মোরো রিফ্লেক্স প্রিভেনশন সিস্টেম। বাচ্চাকে মোড়ানোর সাথে সাথেই দেখবেন পার্থক্য।
          </p>
        </div>

        {/* Image + top benefits */}
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-5">
          <div className="relative mx-auto w-full max-w-md lg:col-span-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] border-8 border-white shadow-2xl shadow-brand/20">
              <Image
                src={img}
                alt="ঘুমপাড়া সোয়াডেলে মোড়া শান্ত ঘুমন্ত শিশু"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 40vw"
              />
            </div>
            <div className="absolute -bottom-4 left-1/2 w-[85%] -translate-x-1/2 rounded-2xl bg-white p-4 text-center shadow-xl">
              <div className="text-sm font-bold text-ink">
                “মায়ের গর্ভের মতো নিরাপত্তা — প্রতিটি রাতে”
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                WHO-সমর্থিত নবজাতক যত্ন পদ্ধতি Swaddling-এর আধুনিক রূপ
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-3">
            {BENEFITS.slice(0, 2).map((b) => (
              <div
                key={b.title}
                className={`rounded-3xl border p-6 shadow-sm ${
                  b.highlight ? "border-brand/40 bg-brand-soft/60" : "border-border bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand">
                    <b.icon className="size-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{b.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Remaining benefits */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.slice(2).map((b) => (
            <div
              key={b.title}
              className="rounded-3xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft">
                <b.icon className="size-5 text-brand" />
              </div>
              <h3 className="mt-3 text-base font-bold text-ink">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="#order">
            <Button
              size="lg"
              className="rounded-full bg-brand px-10 py-6 text-lg font-bold text-white shadow-xl shadow-brand/30 hover:bg-brand-deep"
            >
              আমার বাচ্চার জন্য অর্ডার করি
            </Button>
          </a>
          <p className="mt-2 text-sm text-muted-foreground">
            ৳{singlePrice} থেকে শুরু • ক্যাশ অন ডেলিভারি • {isAllFree(deliveryConfig) ? "ফ্রি ডেলিভারি" : "সারা দেশে ডেলিভারি"}
          </p>
        </div>
      </div>
    </section>
  );
}
