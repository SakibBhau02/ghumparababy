"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Stethoscope } from "lucide-react";

const SYMPTOMS = [
  "ঘুমের মধ্যে হঠাৎ চমকে উঠে দুই হাত ছড়িয়ে কাঁদে",
  "সামান্য শব্দেই ঘুম ভেঙে যায়",
  "রাতে বারবার জেগে ওঠে, পুরো রাত ঘুমায় না",
  "কোলে নিলে শান্ত থাকে, বিছানায় দিলেই কান্না",
  "ঘুম ভাঙার পর ঘণ্টার পর ঘণ্টা তাস দিলেও ঘুমায় না",
  "ঠান্ডায় সর্দি-কাশি হয়ে ঘুম আরো এলোমেলো হয়ে গেছে",
];

export function SymptomCheck() {
  const [checked, setChecked] = useState<boolean[]>(Array(SYMPTOMS.length).fill(false));
  const score = checked.filter(Boolean).length;

  const toggle = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2.5rem] border-2 border-honey/40 bg-white p-6 shadow-xl sm:p-10">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-honey/15 px-4 py-1.5 text-sm font-semibold text-honey">
              <Stethoscope className="size-4" /> ৩০ সেকেন্ডের পরীক্ষা
            </span>
            <h2 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">
              আপনার বাচ্চার কি এই লক্ষণগুলো দেখা যাচ্ছে?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              যেগুলো প্রযোজ্য, সেগুলোতে টিক দিন — রেজাল্ট সাথে সাথেই দেখুন।
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {SYMPTOMS.map((symptom, i) => (
              <button
                key={symptom}
                onClick={() => toggle(i)}
                aria-pressed={checked[i]}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  checked[i]
                    ? "border-brand bg-brand-soft/70"
                    : "border-border bg-cream/50 hover:border-honey/50"
                }`}
              >
                {checked[i] ? (
                  <CheckCircle2 className="size-6 shrink-0 text-brand" />
                ) : (
                  <Circle className="size-6 shrink-0 text-muted-foreground/40" />
                )}
                <span className={`text-sm font-medium sm:text-base ${checked[i] ? "text-ink" : "text-muted-foreground"}`}>
                  {symptom}
                </span>
              </button>
            ))}
          </div>

          {/* Result */}
          <div
            className={`mt-6 rounded-2xl p-5 text-center transition-all ${
              score === 0
                ? "bg-muted"
                : score >= 3
                  ? "bg-rust/10 border-2 border-rust/30"
                  : "bg-honey/10 border-2 border-honey/30"
            }`}
          >
            {score === 0 ? (
              <p className="text-sm text-muted-foreground sm:text-base">
                অন্তত একটি লক্ষণ বেছে নিন রেজাল্ট দেখতে 👆
              </p>
            ) : (
              <>
                <div className="text-3xl font-bold text-ink">
                  {score}/{SYMPTOMS.length} লক্ষণ মিলেছে
                </div>
                {score >= 3 ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink sm:text-base">
                    <b>সতর্কতা:</b> আপনার বাচ্চার ঘুমে মোরো রিফ্লেক্সের প্রভাব স্পষ্ট। প্রতিদিন
                    বারবার ঘুম ভাঙার এই চক্র দীর্ঘদিন চললে ঘুমের ঘাটতি জমা হবে — এখনই পদক্ষেপ নেওয়া
                    জরুরি।
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-ink sm:text-base">
                    শুরুর দিকের লক্ষণ। নবজাতকের মোরো রিফ্লেক্স প্রথম মাসে ক্রমশ তীব্র হয় — আজ
                    যা হালকা, কাল তা বাড়তে পারে। আগে থেকে প্রস্তুতি নিন।
                  </p>
                )}
                <a href="#order">
                  <Button className="mt-4 rounded-full bg-brand px-8 py-5 text-base font-bold text-white shadow-lg hover:bg-brand-deep">
                    সোয়াডেল অর্ডার করে সমাধান নিন
                  </Button>
                </a>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            * এটি শুধুমাত্র সচেতনতার জন্য, চিকিৎসা পরামর্শ নয়। গুরুতর সমস্যায় শিশু বিশেষজ্ঞের সাথে
            যোগাযোগ করুন।
          </p>
        </div>
      </div>
    </section>
  );
}
