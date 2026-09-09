import Image from "next/image";
import { toBn, PRODUCT_COLORS } from "@/lib/landing-data";
import { Ruler, Layers, Sparkles, ShieldCheck } from "lucide-react";

const SPECS = [
  { icon: Ruler, title: "সাইজ", desc: "০-৯ মাসের নবজাতকের জন্য পারফেক্ট ফিট (৭৫×৪৫ সেমি)" },
  { icon: Layers, title: "ফেব্রিক", desc: "বাইরে প্রিমিয়াম মল্টি-ফ্লিস, ভেতরে কোমল কটন লাইনিং" },
  { icon: Sparkles, title: "ডিজাইন", desc: "কিউট বিয়ার-ইয়ার্স হুড, পায়ে ফ্রি মুভমেন্ট পাউচ" },
  { icon: ShieldCheck, title: "সেফটি", desc: "হুড ছাড়া মোড়ানো যায় — বাচ্চার মুখমণ্ডল খোলা থাকে" },
];

export function Showcase() {
  return (
    <section className="bg-secondary/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
            পণ্য পরিচিতি
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            ৬টি প্রিয় কালারে — আপনার বাচ্চার জন্য বেছে নিন
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            প্রতিটি কালার একই প্রিমিয়াম কোয়ালিটি। ছেলে হোক বা মেয়ে — সবার জন্যই আছে পছন্দের অপশন।
          </p>
        </div>

        {/* Color gallery */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PRODUCT_COLORS.map((color) => (
            <div
              key={color.id}
              className="group overflow-hidden rounded-3xl bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={color.image}
                  alt={`${color.label} কালারের ঘুমপাড়া সোয়াডেল`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 45vw, 30vw"
                />
              </div>
              <div className="flex items-center justify-center gap-2 py-3">
                <span
                  className="size-4 rounded-full border border-border"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-ink">{color.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Specs */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SPECS.map((spec) => (
            <div key={spec.title} className="rounded-3xl border border-border bg-white p-5">
              <spec.icon className="size-6 text-brand" />
              <h3 className="mt-2.5 font-bold text-ink">{spec.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{spec.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ★ ৪.৯ রেটিং — {toBn(5000)}+ ভেরিফাইড অর্ডারের ভিত্তিতে
        </p>
      </div>
    </section>
  );
}
