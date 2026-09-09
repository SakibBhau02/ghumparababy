import { toBn } from "@/lib/landing-data";
import { isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import { Flame, Check } from "lucide-react";
import { Countdown } from "./countdown";

export function Pricing({ deliveryConfig }: { deliveryConfig: DeliveryConfig }) {
  const deliveryPerk = isAllFree(deliveryConfig) ? "ফ্রি ডেলিভারি" : "সারা দেশে ডেলিভারি";

  const PACKAGE_LIST = [
    {
      id: "single",
      name: "সিঙ্গেল প্যাক",
      qty: "১টি সোয়াডেল",
      price: 549,
      oldPrice: 899,
      save: 350,
      tag: null as string | null,
      perks: [deliveryPerk, "ক্যাশ অন ডেলিভারি"],
    },
    {
      id: "combo2",
      name: "কম্বো প্যাক",
      qty: "২টি সোয়াডেল",
      price: 999,
      oldPrice: 1798,
      save: 799,
      tag: "সবচেয়ে জনপ্রিয়",
      perks: ["২ কালার পছন্দের সুযোগ", deliveryPerk, "ক্যাশ অন ডেলিভারি"],
    },
    {
      id: "combo3",
      name: "ফ্যামিলি প্যাক",
      qty: "৩টি সোয়াডেল",
      price: 1399,
      oldPrice: 2697,
      save: 1298,
      tag: "সেরা ভ্যালু",
      perks: ["৩ কালার পছন্দের সুযোগ", deliveryPerk, "ক্যাশ অন ডেলিভারি", "গিফট র‍্যাপ ফ্রি"],
    },
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-rust/10 px-4 py-1.5 text-sm font-semibold text-rust">
            <Flame className="size-4" /> লঞ্চ অফার — স্টক সীমিত
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            আজকের বিশেষ দাম — মাত্র কয়েক ঘণ্টা বাকি
          </h2>
          <div className="mt-4 flex justify-center">
            <Countdown />
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PACKAGE_LIST.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative flex flex-col rounded-[2rem] border-2 bg-white p-7 shadow-sm transition-shadow hover:shadow-xl ${
                pkg.id === "combo2" ? "border-brand shadow-lg shadow-brand/10 md:-translate-y-2" : "border-border"
              }`}
            >
              {pkg.tag && (
                <span
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-sm font-bold text-white ${
                    pkg.id === "combo2" ? "bg-brand" : "bg-leaf"
                  }`}
                >
                  {pkg.tag}
                </span>
              )}

              <h3 className="text-xl font-bold text-ink">{pkg.name}</h3>
              <div className="mt-1 text-sm text-muted-foreground">{pkg.qty}</div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${pkg.id === "combo2" ? "text-brand" : "text-ink"}`}>
                  ৳{toBn(pkg.price)}
                </span>
                <span className="text-lg text-muted-foreground line-through">৳{toBn(pkg.oldPrice)}</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-leaf">
                সাশ্রয় ৳{toBn(pkg.save)}!
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {pkg.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="size-4 shrink-0 text-leaf" /> {perk}
                  </li>
                ))}
              </ul>

              <a href="#order" className="mt-6">
                <button
                  className={`w-full rounded-full py-3.5 text-base font-bold transition-colors ${
                    pkg.id === "combo2"
                      ? "bg-brand text-white hover:bg-brand-deep"
                      : "border-2 border-brand/30 text-brand hover:bg-brand-soft"
                  }`}
                >
                  এটি নির্বাচন করুন
                </button>
              </a>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl rounded-2xl bg-honey/10 border border-honey/30 p-4 text-center text-sm text-ink">
          💡 <b>মায়েদের পরামর্শ:</b> প্রতিদিন ব্যবহার ও ধোয়ার জন্য কমপক্ষে ২টি নেওয়াই স্মার্ট —
          কম্বো প্যাকে প্রতি পিসের দাম আরো কম!
        </p>
      </div>
    </section>
  );
}
