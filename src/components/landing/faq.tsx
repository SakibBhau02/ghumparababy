import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HOTLINE, HOTLINE_LINK } from "@/lib/landing-data";
import { Phone } from "lucide-react";

const FAQS = [
  {
    q: "মোরো রিফ্লেক্স কি আমার বাচ্চারও হবে/হয়েছে?",
    a: "হ্যাঁ, মোরো রিফ্লেক্স প্রতিটি সুস্থ নবজাতকেরই স্বাভাবিক প্রতিবর্তন (Cleveland Clinic)। এটি রোগ নয়, বরং মস্তিষ্কের বিকাশের একটি ধাপ। তবে এটি বারবার ঘুম ভাঙায় — তাই একে নিয়ন্ত্রণে রাখাই প্যারেন্টদের কাজ। Swaddling-ই এর সবচেয়ে প্রমাণিত ও সহজ সমাধান।",
  },
  {
    q: "কোন বয়সের শিশুদের জন্য এটি ব্যবহার করা যাবে?",
    a: "০ থেকে ৯ মাসের শিশুদের জন্য পারফেক্ট। বিশেষ করে ০-৬ মাস — এই সময়েই মোরো রিফ্লেক্স সবচেয়ে তীব্র এবং বাচ্চা সবচেয়ে বেশি ঘুম ভাঙার সমস্যায় থাকে।",
  },
  {
    q: "ঘুমপাড়া সোয়াডেল কি অনেক গরম হয়ে যাবে?",
    a: "না। বাইরের মল্টি-ফ্লিস উষ্ণতা ধরে রাখে, কিন্তু ভেতরের কটন লাইনিং ঘাম শুষে নেয় এবং বাতাস চলাচলের জায়গা রাখে। শীতের রাতে বাচ্চা উষ্ণ থাকে অথচ ঘামে না। তবে বাড়ির তাপমাত্রা অনুযায়ী হুড ছাড়া ব্যবহার করতে পারেন।",
  },
  {
    q: "সোয়াডেল কখন পরা বন্ধ করব?",
    a: "বাচ্চা গড়িয়ে পড়া (roll over) শুরু করলে — সাধারণত ৩-৪ মাসে — নিরাপত্তার জন্য দুই হাত বাইরে রেখে ব্যবহার করুন বা ধীরে ধীরে বন্ধ করুন। এটি আন্তর্জাতিক সেফ স্লিপ গাইডলাইন অনুযায়ী জরুরি।",
  },
  {
    q: "কিভাবে ধুবো? নরমতা কি নষ্ট হবে?",
    a: "মেশিনে বা হাতে — মৃদু ডিটারজেন্ট দিয়ে ধুয়ে ছায়াযুক্ত জায়গায় শুকান। বারবার ধুলেও ফ্লিসের নরমতা ও রং নষ্ট হয় না। প্রতিদিন ব্যবহারের জন্য ২টি কেনাই ভালো — একটা শুকাবে, আরেকটা পরবে।",
  },
  {
    q: "ডেলিভারি পেতে কতদিন লাগবে? ঢাকার বাইরেও পাওয়া যাবে?",
    a: "ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ২-৪ দিন। আমরা সারা বাংলাদেশে (৬৪ জেলা) কুরিয়ারে ফ্রি ডেলিভারি দিই। ডেলিভারির আগে আমাদের প্রতিনিধি কল করে কনফার্ম করবেন।",
  },
  {
    q: "পেমেন্ট কিভাবে করব?",
    a: "কোনো অগ্রিম পেমেন্ট লাগবে না! ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে চেক করে তারপর টাকা দিন। পণ্য পছন্দ না হলে নিতে না-ও পারেন, কোনো প্রশ্ন করা হবে না।",
  },
  {
    q: "সাইজ বা কালার পছন্দ না হলে এক্সচেঞ্জ করা যাবে?",
    a: "হ্যাঁ! ডেলিভারির ৭ দিনের মধ্যে অব্যবহৃত অবস্থায় এক্সচেঞ্জ করা যাবে। হেল্পলাইনে কল করলেই প্রক্রিয়া সম্পন্ন হবে।",
  },
];

export function FAQ() {
  return (
    <section className="bg-secondary/40 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
            আপনার প্রশ্নের উত্তর
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">সাধারণ প্রশ্নোত্তর</h2>
        </div>

        <Accordion type="single" collapsible className="mt-8 space-y-3">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-2xl border border-border bg-white px-5 shadow-sm"
            >
              <AccordionTrigger className="py-4 text-left text-base font-bold text-ink hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-8 rounded-3xl border border-brand/30 bg-white p-6 text-center">
          <p className="text-ink">আরো প্রশ্ন আছে? আমরা আছি আপনার পাশে।</p>
          <a href={HOTLINE_LINK}>
            <Button className="mt-3 rounded-full bg-brand px-8 font-bold text-white hover:bg-brand-deep">
              <Phone className="mr-2 size-4" /> কল করুন {HOTLINE}
            </Button>
          </a>
          <p className="mt-2 text-xs text-muted-foreground">প্রতিদিন সকাল ৯টা — রাত ১০টা</p>
        </div>
      </div>
    </section>
  );
}
