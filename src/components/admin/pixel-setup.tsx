"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  extractPixelId,
  PIXEL_EVENT_IDS,
  PIXEL_EVENT_META,
  type PixelConfig,
  type PixelEventId,
  type PixelEvents,
} from "@/lib/pixel-shared";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Link2,
  Link2Off,
  Loader2,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";

/**
 * Admin: Meta Pixel সেটআপ — কোড হাতে না দিয়ে এখান থেকেই:
 *  ১) Pixel ID বা Meta এর পুরো pixel code পেস্ট → অটো-ডিটেক্ট → সংযোগ
 *  ২) ইভেন্ট চালু/বন্ধ (PageView, ViewContent, InitiateCheckout, Purchase, Contact)
 * সব সেটিং DB-তে সেভ হয়, ল্যান্ডিং পেজে সাথে সাথে প্রযোজ্য হয়।
 */

export function PixelSetup({ initialConfig }: { initialConfig: PixelConfig }) {
  const router = useRouter();
  const { toast } = useToast();

  const [saved, setSaved] = useState<PixelConfig>(initialConfig);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<PixelEvents>(initialConfig.events);
  const [busy, setBusy] = useState<null | "connect" | "disconnect" | "events">(
    null
  );

  const connected = saved.enabled && !!saved.pixelId;
  const savedButOff = !saved.enabled && !!saved.pixelId;

  const detected = useMemo(() => extractPixelId(input), [input]);
  const eventsDirty =
    JSON.stringify(events) !== JSON.stringify(saved.events);
  const activeEvents = PIXEL_EVENT_IDS.filter((id) => saved.events[id]);

  /** PUT /api/admin/pixel — সফল হলে নতুন config রিটার্ন */
  const put = async (body: Record<string, unknown>): Promise<PixelConfig | null> => {
    const res = await fetch("/api/admin/pixel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      router.replace("/admin/login");
      return null;
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "সেভ করা যায়নি।");
    }
    return data.config as PixelConfig;
  };

  const connect = async () => {
    setBusy("connect");
    try {
      const config = await put(
        detected ? { input, enabled: true } : { enabled: true }
      );
      if (!config) return;
      setSaved(config);
      setEvents(config.events);
      setInput("");
      toast({
        title: "✓ Pixel সংযোগ স্থাপিত হয়েছে",
        description:
          "ল্যান্ডিং পেজ রিলোড দিলেই Pixel লাইভ হয়ে যাবে — Meta Pixel Helper দিয়ে যাচাই করতে পারবেন।",
      });
    } catch (e) {
      toast({
        title: "সংযোগ হয়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      const config = await put({ enabled: false });
      if (!config) return;
      setSaved(config);
      toast({
        title: "Pixel বন্ধ করা হয়েছে",
        description: "ল্যান্ডিং পেজ থেকে Pixel সরে যাবে (রিলোডে)। ID সংরক্ষিত আছে — যেকোনো সময় আবার চালু করতে পারবেন।",
      });
    } catch (e) {
      toast({
        title: "বন্ধ করা যায়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const saveEvents = async () => {
    setBusy("events");
    try {
      const config = await put({ events });
      if (!config) return;
      setSaved(config);
      setEvents(config.events);
      toast({
        title: "ইভেন্ট সেটিংস সেভ হয়েছে",
        description: connected
          ? `এখন ${activeEvents.length}টি ইভেন্ট Meta-তে যাবে।`
          : "Pixel সংযোগ করার পর ইভেন্টগুলো কাজ করা শুরু করবে।",
      });
    } catch (e) {
      toast({
        title: "সেভ হয়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-cream/60 pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin")}
              className="rounded-full"
            >
              <ArrowLeft className="mr-1.5 size-4" /> অর্ডার
            </Button>
            <div>
              <h1 className="text-lg font-bold text-ink">
                <Activity className="mr-1.5 inline size-5 text-brand" />
                Meta Pixel সেটআপ
              </h1>
              <p className="text-xs text-muted-foreground">
                কোড হাতে দেওয়া লাগবে না — এখান থেকেই সংযোগ ও ইভেন্ট
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 pt-6">
        {/* Status banner */}
        <div
          className={`rounded-2xl border p-5 ${
            connected
              ? "border-leaf/40 bg-leaf/5"
              : savedButOff
                ? "border-honey/50 bg-honey/5"
                : "border-border bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {connected ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-leaf" />
              ) : (
                <HelpCircle className="mt-0.5 size-6 shrink-0 text-honey" />
              )}
              <div>
                <div className="font-bold text-ink">
                  {connected
                    ? "Pixel সংযোগ স্থাপিত ✓ ওয়েবসাইটে চালু আছে"
                    : savedButOff
                      ? "Pixel সংযোগ বন্ধ আছে — ID সংরক্ষিত আছে"
                      : "এখনো কোনো Pixel সংযোগ হয়নি"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {connected ? (
                    <>
                      Pixel ID:{" "}
                      <span className="font-mono font-bold text-ink">
                        {saved.pixelId}
                      </span>{" "}
                      • চালু ইভেন্ট:{" "}
                      <b className="text-ink">{activeEvents.length}টি</b>{" "}
                      ({activeEvents
                        .map((id) => PIXEL_EVENT_META[id].fbEvent)
                        .join(", ")})
                    </>
                  ) : savedButOff ? (
                    <>
                      সংরক্ষিত ID:{" "}
                      <span className="font-mono font-bold text-ink">
                        {saved.pixelId}
                      </span>{" "}
                      — আবার চালু করতে নিচের{" "}
                      <b className="text-ink">আবার সংযোগ করুন</b> বাটনে চাপুন।
                    </>
                  ) : (
                    "Meta অ্যাড চালানোর আগে নিচের ধাপ ১ থেকে Pixel সংযোগ করে নিন — অর্ডার ট্র্যাকিং ও রিটার্গেটিং অডিয়েন্স এর ওপরই নির্ভর করে।"
                  )}
                </div>
              </div>
            </div>
            {savedButOff && (
              <Button
                onClick={connect}
                disabled={busy !== null}
                className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep"
              >
                {busy === "connect" ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Link2 className="mr-1.5 size-4" />
                )}
                আবার সংযোগ করুন
              </Button>
            )}
          </div>
        </div>

        {/* Step 1: Connect */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
              ১
            </div>
            <div>
              <h2 className="font-bold text-ink">Pixel সংযোগ করুন</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                আপনার <b>Pixel ID</b> (১৫-১৬ ডিজিটের সংখ্যা) অথবা Meta এর দেওয়া{" "}
                <b>পুরো pixel code</b> — যেটা সুবিধা, সেটাই নিচে পেস্ট করুন। ID
                অটোমেটিক ডিটেক্ট হয়ে যাবে, কোডে হাত দিতে হবে না।
              </p>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            spellCheck={false}
            dir="ltr"
            placeholder={`যেমন: 1234567890123456\n\nঅথবা পুরো কোড:\n<!-- Meta Pixel Code -->\n<script>...\nfbq('init', '1234567890123456');\n...</script>`}
            className="mt-4 w-full rounded-xl border border-border bg-cream/60 p-3.5 font-mono text-xs leading-relaxed text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
          />

          {input.trim() !== "" && (
            <div
              className={`mt-2.5 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                detected
                  ? "border-leaf/40 bg-leaf/10 text-ink"
                  : "border-red-200 bg-red-50 text-ink"
              }`}
            >
              {detected ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              )}
              {detected ? (
                <span>
                  Pixel ID ডিটেক্ট হয়েছে:{" "}
                  <span className="font-mono font-bold">{detected}</span>
                </span>
              ) : (
                <span>
                  এই টেক্সটে কোনো Pixel ID পাওয়া যায়নি। Meta Events Manager
                  থেকে কপি করা কোড বা ১৫-১৬ ডিজিটের ID দিন।
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              onClick={connect}
              disabled={
                busy !== null || connected || (!detected && !saved.pixelId)
              }
              className="rounded-full bg-brand font-bold text-white shadow-lg shadow-brand/25 hover:bg-brand-deep disabled:opacity-60"
            >
              {busy === "connect" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 size-4" />
              )}
              সংযোগ করুন
            </Button>
            {connected && (
              <Button
                onClick={disconnect}
                disabled={busy !== null}
                variant="outline"
                className="rounded-full border-red-200 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {busy === "disconnect" ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Link2Off className="mr-1.5 size-4" />
                )}
                সংযোগ বিচ্ছিন্ন করুন
              </Button>
            )}
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-leaf" />
            সংযোগ করার সাথে সাথেই ল্যান্ডিং পেজে Pixel লোড হবে — রিলোড লাগবে
            শুধু যাচাই করতে। বিজ্ঞাপন অ্যাকাউন্ট থেকে কোনো অনুমতি লাগে না।
          </p>
        </section>

        {/* Step 2: Events */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                ২
              </div>
              <div>
                <h2 className="font-bold text-ink">ইভেন্ট ম্যানেজমেন্ট</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  কোন কোন ইভেন্ট Meta-তে পাঠানো হবে তা বেছে নিন — বাকি সব
                  অটোমেটিক সামলানো আছে।
                </p>
              </div>
            </div>
            <Button
              onClick={saveEvents}
              disabled={busy !== null || !eventsDirty}
              className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {busy === "events" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-4" />
              )}
              ইভেন্ট সেভ করুন
            </Button>
          </div>

          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {PIXEL_EVENT_IDS.map((id: PixelEventId) => {
              const meta = PIXEL_EVENT_META[id];
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink">
                        {meta.label}
                      </span>
                      <span className="rounded-md bg-cream px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                        {meta.fbEvent}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {meta.desc}
                    </p>
                  </div>
                  <Switch
                    checked={events[id]}
                    onCheckedChange={(v) =>
                      setEvents((cur) => ({ ...cur, [id]: v }))
                    }
                    aria-label={meta.label}
                    className="shrink-0 data-[state=checked]:bg-brand"
                  />
                </div>
              );
            })}
          </div>
          {eventsDirty && (
            <p className="mt-2.5 text-xs font-semibold text-honey">
              • অসংরক্ষিত পরিবর্তন আছে — সেভ করতে ভুলবেন না।
            </p>
          )}
        </section>

        {/* Step 3: Help */}
        <section className="rounded-2xl border border-dashed border-border bg-white/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 shrink-0 text-brand" />
            <div className="min-w-0">
              <h2 className="font-bold text-ink">Pixel ID কোথায় পাবেন?</h2>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <b className="text-ink">১.</b>{" "}
                  <a
                    href="https://business.facebook.com/events_manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                  >
                    Meta Events Manager
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  এ যান (আপনার Facebook অ্যাকাউন্ট/পেজ দিয়ে লগইন থাকতে হবে)।
                </li>
                <li>
                  <b className="text-ink">২.</b> <b className="text-ink">Connect Data Sources → Web → Meta Pixel</b>{" "}
                  বেছে Pixel-এ একটি নাম দিয়ে তৈরি করুন।
                </li>
                <li>
                  <b className="text-ink">৩.</b> সেটআপে{" "}
                  <b className="text-ink">“Manually add pixel code”</b> (বা
                  “Set up manually”) সিলেক্ট করুন — Meta একটি কোড দেখাবে, তাতে
                  ১৫-১৬ ডিজিটের <span className="font-mono font-bold text-ink">fbq(&apos;init&apos;, ...)</span>{" "}
                  ID থাকবে।
                </li>
                <li>
                  <b className="text-ink">৪.</b> পুরো কোড বা শুধু ID সংখ্যাটা —
                  যেকোনোটা ধাপ ১ এর বক্সে পেস্ট করে{" "}
                  <b className="text-ink">সংযোগ করুন</b> চাপুন। ব্যস! এখানেই
                  সেটআপ শেষ।
                </li>
                <li>
                  <b className="text-ink">৫.</b> যাচাই করতে: ল্যান্ডিং পেজ
                  ওপেন করে Chrome-এর{" "}
                  <b className="text-ink">Meta Pixel Helper</b> এক্সটেনশন দিয়ে
                  দেখুন — চালু ইভেন্টগুলো সবুজ হয়ে দেখাবে।
                </li>
              </ol>
              <p className="mt-3 rounded-xl bg-brand-soft/60 p-3 text-xs leading-relaxed text-ink">
                <b>টিপ:</b> পেস্ট করার সময় কোড বড় হলেও সমস্যা নেই — সিস্টেম
                নিজেই ID খুঁজে নেয়। শুধু নিশ্চিত করুন কোডটা Events Manager থেকে
                কপি করা (অন্য কারো কোড পেস্ট করলে ওই আইডির অ্যাকাউন্টে ডেটা
                যাবে)।
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
