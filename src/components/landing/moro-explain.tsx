import { AlertTriangle, Volume2, Hand, Moon } from "lucide-react";

export function MoroExplain() {
  return (
    <section id="moro" className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
            প্রথমে জানুন — তারপর সিদ্ধান্ত নিন
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-snug text-ink sm:text-4xl">
            মোরো রিফ্লেক্স (Moro Reflex) কী?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            মোরো রিফ্লেক্স হলো নবজাতকের <b className="text-foreground">চমকে ওঠার স্বাভাবিক প্রতিবর্তন</b> —
            জন্মের সাথে সাথেই প্রতিটি শিশুর মধ্যে এটি থাকে। হঠাৎ শব্দ, আলো বা যখন বাচ্চার{" "}
            <b className="text-foreground">&ldquo;পড়ে যাচ্ছি&rdquo;</b> মনে হয়, তখন তার দুই হাত হঠাৎ
            ছড়িয়ে যায়, পিঠ বাঁকে এবং সে কেঁদে ওঠে। মায়ের গর্ভে সব ভর দেওয়া থাকায় জন্মের পর এই
            &ldquo;ভাঙা ভারসাম্যের&rdquo; অনুভূতিই বাচ্চাকে ভয় দেখায়।
          </p>
        </div>

        {/* The 3 stages */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Volume2,
              step: "ধাপ ১",
              title: "হঠাৎ ট্রিগার",
              desc: "দরজা বন্ধের শব্দ, পাখির ডাক বা হালকা নড়াচড়াই যথেষ্ট — ঘুমন্ত বাচ্চার মস্তিষ্ক “বিপদ!” সংকেত পাঠায়।",
            },
            {
              icon: Hand,
              step: "ধাপ ২",
              title: "চমকে ওঠা",
              desc: "দুই হাত পাশে ছড়িয়ে যায়, আঙুল খুলে যায়, পিঠ বেঁকে যায় — এটাই মোরো রিফ্লেক্সের ক্লাসিক রূপ।",
            },
            {
              icon: Moon,
              step: "ধাপ ৩",
              title: "ঘুম ভেঙে কান্না",
              desc: "নিজেই নিজের চমকে ওঠাকে ভয় পেয়ে কেঁদে ওঠে — ঘুম ভেঙে যায়, মাকে তখন ঘণ্টার পর ঘণ্টা তাস দিতে হয়।",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-3xl border border-border bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft">
                <item.icon className="size-7 text-brand" />
              </div>
              <div className="mt-3 text-xs font-bold uppercase tracking-wide text-honey">
                {item.step}
              </div>
              <h3 className="mt-1 text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Timeline warning */}
        <div className="mt-8 overflow-hidden rounded-3xl border-2 border-dashed border-rust/30 bg-rust/5 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-rust/15">
              <AlertTriangle className="size-7 text-rust" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink sm:text-xl">
                সবচেয়ে গুরুত্বপূর্ণ কথা: প্রথম ৪-৬ মাসটাই সংকটকাল
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                মোরো রিফ্লেক্স জন্মের পর <b className="text-foreground">প্রথম মাসে সবচেয়ে তীব্র</b> হয় এবং{" "}
                <b className="text-foreground">৪-৬ মাস</b> পর্যন্ত থাকে। গবেষকরা বলছেন — এই সময়ে বাচ্চা
                যখন ঘুমের মধ্যে বারবার চমকে ওঠে, তখন তার{" "}
                <b className="text-foreground">গভীর ঘুম (quiet sleep) ব্যাহত হয়</b>। আর গভীর ঘুমই বাচ্চার
                মস্তিষ্কের বিকাশ ও শারীরিক বৃদ্ধির মূল ইঞ্জিন। এজন্যই শিশু বিশেষজ্ঞরা এই সময়ে{" "}
                <b className="text-brand">swaddling বা মোড়ানোর</b> পরামর্শ দেন — যাতে বাচ্চার হাত-পা
                আঁটকে থাকে এবং চমকে ওঠার প্রতিক্রিয়া ট্রিগার না হয়।
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
