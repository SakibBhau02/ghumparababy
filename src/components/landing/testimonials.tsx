import { Star, BadgeCheck } from "lucide-react";

const REVIEWS = [
  {
    name: "সুমাইয়া আক্তার",
    area: "মিরপুর, ঢাকা",
    baby: "২ মাসের বাচ্চার মা",
    text: "আমার মেয়ে রাতে প্রতি ঘণ্টায় চমকে উঠে কাঁদতো। ইউটিউবে মোরো রিফ্লেক্সের ভিডিও দেখে এটা অর্ডার করি। প্রথম রাতেই ৪ ঘণ্টা টানা ঘুম! এখন আমার ঘুম হয়, মেয়ের ঘুম হয় — এই টাকার জন্য আর কী চাই!",
    stars: 5,
  },
  {
    name: "তানজিলা রহমান",
    area: "চট্টগ্রাম",
    baby: "১.৫ মাসের বাচ্চার মা",
    text: "শীতের সময় বাচ্চা সারা রাত কাঁপতো, সর্দি লাগতো থামতো না। এই সোয়াডেল পরার পর কম্বল খুলে যাওয়ার ভয় আর নেই। ভেতরটা কত নরম — ইদানীং সোয়াডেল ছাড়া বাচ্চা ঘুমাতেই চায় না।",
    stars: 5,
  },
  {
    name: "মেহেদী হাসান",
    area: "রাজশাহী",
    baby: "নবজাতকের বাবা",
    text: "স্ত্রীকে রাতজুড়ে বাচ্চা তাস দিতে দেখে খুব চিন্তায় ছিলাম। দারাজে অনেক দেখলাম, কিন্তু কোয়ালিটি নিয়ে সন্দেহ ছিল। এখানে ক্যাশ অন ডেলিভারি ছিল বলে নিয়েছি — হাতে পেয়ে দেখে সত্যিই মুগ্ধ। ধন্যবাদ ঘুমপাড়া!",
    stars: 5,
  },
  {
    name: "নুসরাত জাহান",
    area: "সিলেট",
    baby: "৩ মাসের বাচ্চার মা",
    text: "দুইটা নিয়েছি কম্বোতে — একটা ধোয়ার সময় আরেকটা পরাই। কালার ছবির মতোই সুন্দর, ফ্লিস মান একদম ফাইভ স্টার। মাশাআল্লাহ, আমার ছেলে এখন রাত ১১টা থেকে সরাসরি ভোর পর্যন্ত ঘুমায়!",
    stars: 5,
  },
  {
    name: "ফারজানা ইসলাম",
    area: "উত্তরা, ঢাকা",
    baby: "গর্ভবতী — আগাম কেনেন",
    text: "বাচ্চা হওয়ার আগেই একটা কিনে রেখেছি। বান্ধবীর বাচ্চায় দেখেছি কত কাজের। ডেলিভারি খুব ফাস্ট পেয়েছি, প্যাকেজিংও সুন্দর। সব নতুন মাকে এটা গিফট করি এখন!",
    stars: 5,
  },
  {
    name: "রুবিনা পারভীন",
    area: "খুলনা",
    baby: "২.৫ মাসের বাচ্চার মা",
    text: "শুরুতে মনে হচ্ছিল ৫৫০ টাকা বেশি কেন? এখন বলি — আমার ঘুমের দাম কি কম! মোড়ানোর পর বাচ্চা এমন শান্ত হয় যে কোলে না নিয়েও সে ঘুমায়। ঢাকার বাইরে ২ দিনে ডেলিভারি পেয়েছি।",
    stars: 5,
  },
];

export function Testimonials() {
  return (
    <section className="bg-secondary/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
            কাস্টমার রিভিউ
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
            ৫,০০০+ মা-বাবা কেন বিশ্বাস করেন?
          </h2>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5 fill-honey text-honey" />
              ))}
            </div>
            <span className="font-bold text-ink">৪.৯/৫</span>
            <span className="text-muted-foreground">— ভেরিফাইড অর্ডারের রেটিং</span>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((review) => (
            <div
              key={review.name}
              className="flex flex-col rounded-3xl border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex">
                {Array.from({ length: review.stars }).map((_, i) => (
                  <Star key={i} className="size-4 fill-honey text-honey" />
                ))}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                “{review.text}”
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">
                  {review.name.charAt(0)}
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1 text-sm font-bold text-ink">
                    {review.name}
                    <BadgeCheck className="size-4 text-leaf" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {review.area} • {review.baby}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
