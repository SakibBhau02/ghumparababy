import { HOTLINE, HOTLINE_LINK, WHATSAPP_DISPLAY, WHATSAPP_LINK } from "@/lib/landing-data";
import { isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import { ShieldCheck, Truck, BadgeCheck } from "lucide-react";

export function FinalCTA({ deliveryConfig }: { deliveryConfig: DeliveryConfig }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-deep to-ink py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -top-10 left-1/4 size-64 rounded-full bg-honey blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-72 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <div className="text-5xl" aria-hidden="true">🧸</div>
        <h2 className="mt-4 text-3xl font-bold leading-snug text-white sm:text-4xl">
          আপনার বাচ্চার ঘুম-হীন রাত আর কতদিন?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">
          আজই মোরো রিফ্লেক্স নিয়ন্ত্রণে রাখুন। আগামীকাল সকালে বাচ্চার গভীর ঘুম আর আপনার শান্ত নিদ্রার
          পার্থক্য নিজেই বুঝবেন — ৫৪৯ টাকায়, ঝুঁকি শূন্য, কারণ হাতে পেয়ে টাকা দিবেন।
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> ক্যাশ অন ডেলিভারি
          </span>
          <span className="flex items-center gap-1.5">
            <Truck className="size-4" /> {isAllFree(deliveryConfig) ? "ফ্রি ডেলিভারি" : "সারা দেশে ডেলিভারি"}
          </span>
          <span className="flex items-center gap-1.5">
            <BadgeCheck className="size-4" /> ৭ দিনের এক্সচেঞ্জ
          </span>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="#order">
            <button className="animate-gentle-pulse rounded-full bg-white px-10 py-4 text-lg font-bold text-brand shadow-2xl transition-colors hover:bg-cream">
              এখনই অর্ডার করুন ↓
            </button>
          </a>
          <a
            href={HOTLINE_LINK}
            className="rounded-full border-2 border-white/40 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-white/10"
          >
            কল করুন: {HOTLINE}
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink py-10 pb-24 text-white/70 sm:pb-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <div className="text-xl font-bold text-white">
              🧸 ঘুমপাড়া <span className="text-honey">বেবি</span>
            </div>
            <p className="mt-1 max-w-sm text-sm">
              নবজাতকের মোরো রিফ্লেক্স প্রিভেনশন ও শীত সুরক্ষায় বাংলাদেশের বিশ্বস্ত ব্র্যান্ড।
            </p>
          </div>
          <div className="text-center text-sm md:text-right">
            <p>
              হেল্পলাইন:{" "}
              <a href={HOTLINE_LINK} className="font-bold text-white hover:text-honey">
                {HOTLINE}
              </a>{" "}
              (সকাল ৯টা — রাত ১০টা)
            </p>
            <p className="mt-1">
              WhatsApp:{" "}
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-white hover:text-honey"
              >
                {WHATSAPP_DISPLAY}
              </a>{" "}
              • ফেসবুক: @ghumparababy
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs leading-relaxed text-white/40">
          <p>
            © ২০২৫ ঘুমপাড়া বেবি। সর্বস্বত্ব সংরক্ষিত। | এই ওয়েবসাইটের তথ্য সচেতনতামূলক; এটি চিকিৎসা
            পরামর্শের বিকল্প নয়।
          </p>
        </div>
      </div>
    </footer>
  );
}
