import { Button } from "@/components/ui/button";
import { toBn } from "@/lib/landing-data";
import { Brain, HeartCrack, Baby, ThermometerSnowflake, TrendingDown, Eye } from "lucide-react";

const STATS = [
  {
    value: "১০০%",
    label: "নবজাতকের মোরো রিফ্লেক্স থাকে",
    detail: "প্রথম মাসে এটি সবচেয়ে তীব্র — এই সময়েই ঘুম ভাঙার সমস্যা শুরু হয়।",
    source: "Cleveland Clinic (2025)",
  },
  {
    value: "৫৯%",
    label: "মায়ের বাচ্চা একটানা ৪ ঘণ্টাও ঘুমায় না",
    detail: "এক বছরের কম বাচ্চার প্যারেন্টদের জরিপে এই ভয়ংকর চিত্র এসেছে।",
    source: "The Lullaby Trust Survey",
  },
  {
    value: `১-${toBn(2)} ঘণ্টা`,
    label: "নবজাতক একবারে যতটুকু ঘুমায়",
    detail: "চমকে ওঠা প্রতিবার এই অল্প ঘুমটুকুও ভেঙে দেয় — মা-বাবা রয়ে যান রাতজুড়ে জাগরণে।",
    source: "Mayo Clinic",
  },
  {
    value: `${toBn(4)}-${toBn(6)} মাস`,
    label: "মোরো রিফ্লেক্স থাকে এতদিন",
    detail: "এই মাসগুলোতে প্রতিদিনের ঘুম-ভাঙা মিলে মোট ঘুমের ঘাটতি হয়ে দাঁড়ায় শত শত ঘণ্টা।",
    source: "NIH / WebMD",
  },
];

const CONSEQUENCES = [
  {
    icon: Brain,
    title: "মস্তিষ্কের বিকাশে বিঘ্ন",
    desc: "গভীর ঘুমের ঘাটতিতে নবজাতকের মস্তিষ্কের নিউরাল কানেকশন গড়ে ওঠার গতি কমে — যে ঘুমে মস্তিষ্ক প্রসেসিং ও বৃদ্ধি হরমোন নিঃসৃত হয়, তা-ই সবচেয়ে ক্ষতিগ্রস্ত হয়।",
  },
  {
    icon: TrendingDown,
    title: "রিটেইনড মোরো রিফ্লেক্স ঝুঁকি",
    desc: "চিলড্রেন ডেভেলপমেন্ট রিসার্চ বলছে — মোরো রিফ্লেক্স ৪-৬ মাসেও না মিলিয়ে গেলে (Retained Moro Reflex) বড় হয়ে শিশুতে hyperactivity, উদ্বেগ, অতি-সংবেদনশীলতা ও মনোযোগের সমস্যা দেখা দেওয়ার আশঙ্কা বাড়ে।",
  },
  {
    icon: HeartCrack,
    title: "মায়ের ক্লান্তি ও হতাশা",
    desc: "রাতের পর রাত ঘুম ভাঙা মায়ের শারীরিক ও মানসিক ক্লান্তি জমা হয় — পোস্টপার্টাম স্ট্রেসের অন্যতম বড় কারণ ঘুম-হীন রাত। মায়ের ভাঙা মন বাচ্চার যত্নেও প্রভাব ফেলে।",
  },
  {
    icon: ThermometerSnowflake,
    title: "শীতে ঠান্ডা-কাশির ঝুঁকি",
    desc: "চমকে ওঠার সময় হাত-পা ছড়িয়ে যাওয়ায় চাদর-কম্বল খুলে যায় — ঠান্ডা রাতে বাচ্চার বুক-পেট ঠান্ডা লেগে সর্দি, কাশি ও বুকে বাতাস আটকে যাওয়ার ঝুঁকি বাড়ে। গবেষণা বলছে প্রথম বছরেই শিশুর গড়ে ৬ বার ঠান্ডা লাগে (Seattle Children's)।",
  },
];

export function StatsSection() {
  return (
    <section className="relative bg-ink py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-rust/20 px-4 py-1.5 text-sm font-semibold text-red-300">
            <Eye className="size-4" /> গবেষণার ভয়ংকর তথ্য
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-white sm:text-4xl">
            মোরো রিফ্লেক্স ঠেকানো না হলে যা হতে পারে…
          </h2>
          <p className="mt-3 text-base leading-relaxed text-white/70 sm:text-lg">
            নিচের পরিসংখ্যানগুলো কোনো ভয় দেখানোর জন্য নয় — এগুলো আন্তর্জাতিক গবেষণা ও স্বাস্থ্য
            সংস্থার প্রকাশিত ডাটা। প্রতিটি সংখ্যার পেছনে হাজারো মা-বাবার ঘুম-হীন রাত।
          </p>
        </div>

        {/* Stat cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors hover:bg-white/10"
            >
              <div className="text-4xl font-bold text-honey sm:text-5xl">{stat.value}</div>
              <div className="mt-2 text-base font-bold leading-snug text-white">{stat.label}</div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{stat.detail}</p>
              <div className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                সূত্র: {stat.source}
              </div>
            </div>
          ))}
        </div>

        {/* Consequences */}
        <h3 className="mt-14 text-center text-2xl font-bold text-white sm:text-3xl">
          দৈনিক যেভাবে ক্ষতি জমতে থাকে
        </h3>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {CONSEQUENCES.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rust/20">
                <item.icon className="size-6 text-red-300" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{item.title}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Transition */}
        <div className="mx-auto mt-12 max-w-2xl rounded-3xl bg-gradient-to-r from-brand to-brand-deep p-8 text-center shadow-2xl">
          <Baby className="mx-auto size-10 text-white" />
          <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            ভাবছেন, “তাহলে সমাধান কী?”
          </h3>
          <p className="mt-2 text-base text-white/85">
            ভয় পাবেন না — এই সমস্যার সমাধান হাজার বছরের পুরনো, আর আজকের গবেষণায় প্রমাণিত। নিচেই দেখুন।
          </p>
          <a href="#solution">
            <Button
              size="lg"
              className="mt-5 rounded-full bg-white px-8 py-6 text-lg font-bold text-brand shadow-xl hover:bg-cream"
            >
              সমাধানটি দেখুন ↓
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
