import { toBn } from "@/lib/landing-data";
import Image from "next/image";

const STEPS = [
  {
    num: "১",
    title: "বাচ্চাকে শুইয়ে দিন",
    desc: "সোয়াডেলের ভেতরে বাচ্চাকে শুইয়ে দিন — পায়ের দিকে যথেষ্ট জায়গা রাখুন যেন পা নড়াতে পারে।",
  },
  {
    num: "২",
    title: "ডান পাশ মুড়ুন",
    desc: "ডান পাশের কাপড় বাচ্চার বুকের ওপর এনে ভালোভাবে জড়িয়ে দিন — কোমল, অথচ আঁটসাঁট।",
  },
  {
    num: "৩",
    title: "বাম পাশ ও হুড",
    desc: "বাম পাশটা এনে ওভারল্যাপ করুন, চাইলে বিয়ার-ইয়ার্স হুডটা মাথায় দিন — ব্যস! গভীর ঘুমের জন্য প্রস্তুত।",
  },
];

export function HowToUse() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
            ব্যবহারের নিয়ম
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            মাত্র ৩ ধাপে মোড়ুন — ৩০ সেকেন্ডেই শেষ
          </h2>
        </div>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <div className="relative order-2 mx-auto w-full max-w-sm lg:order-1">
            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-8 border-white shadow-2xl shadow-brand/20">
              <Image
                src="/images/swaddle-pink.jpg"
                alt="সোয়াডেল ব্যবহারের নিয়ম দেখানো হচ্ছে"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 90vw, 40vw"
              />
            </div>
          </div>

          <div className="order-1 space-y-5 lg:order-2">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex gap-5">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-7 top-16 h-[calc(100%-2.5rem)] w-0.5 bg-brand/20" aria-hidden="true" />
                )}
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white shadow-lg shadow-brand/30">
                  {step.num}
                </div>
                <div className="pt-1">
                  <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl bg-leaf/10 border border-leaf/30 p-4 text-sm text-ink">
              <b className="text-leaf">নিরাপত্তা নোট:</b> বাচ্চা গড়িয়ে পড়া শুরু করলে (সাধারণত{" "}
              {toBn(3)}-{toBn(4)} মাসে) শুধু হুড ছাড়া ব্যবহার করুন বা ধীরে ধীরে বন্ধ করুন। পায়ের
              দিকে সবসময় জায়গা রাখুন — হিপ ডিসপ্লাসিয়া প্রতিরোধে এটি জরুরি।
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
