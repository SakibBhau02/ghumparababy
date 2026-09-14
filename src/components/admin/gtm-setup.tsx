"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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
import {
  extractGtmId,
  GTM_EVENT_IDS,
  GTM_EVENT_META,
  type GtmConfig,
  type GtmEventId,
  type GtmEvents,
} from "@/lib/gtm-shared";

/**
 * Admin: GTM সেটআপ — Container ID পেস্ট, চালু/বন্ধ, dataLayer ইভেন্ট টগল।
 */

export function GtmSetup({ initialConfig }: { initialConfig: GtmConfig }) {
  const router = useRouter();
  const { toast } = useToast();

  const [saved, setSaved] = useState<GtmConfig>(initialConfig);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<GtmEvents>(initialConfig.events);
  const [busy, setBusy] = useState<null | "connect" | "disconnect" | "events">(
    null
  );

  const connected = saved.enabled && !!saved.containerId;
  const savedButOff = !saved.enabled && !!saved.containerId;

  const detected = useMemo(() => extractGtmId(input), [input]);
  const eventsDirty =
    JSON.stringify(events) !== JSON.stringify(saved.events);

  const put = async (body: Record<string, unknown>): Promise<GtmConfig | null> => {
    const res = await fetch("/api/admin/gtm", {
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
    return data.config as GtmConfig;
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
        title: "✓ GTM সংযোগ স্থাপিত হয়েছে",
        description:
          "ল্যান্ডিং পেজ রিলোড দিলেই GTM লাইভ হয়ে যাবে।",
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
        title: "GTM বন্ধ করা হয়েছে",
        description: "ল্যান্ডিং পেজ থেকে GTM সরে যাবে। ID সংরক্ষিত আছে।",
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
          ? `dataLayer-এ ${GTM_EVENT_IDS.filter((id) => events[id]).length}টি ইভেন্ট পাঠানো হবে।`
          : "GTM সংযোগ করার পর ইভেন্টগুলো কাজ করা শুরু করবে।",
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
                <Activity className="mr-1.5 inline size-5 text-green-600" />
                Google Tag Manager সেটআপ
              </h1>
              <p className="text-xs text-muted-foreground">
                কোড হাতে দেওয়া লাগবে না — এখান থেকেই সংযোগ ও dataLayer ইভেন্ট
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
              ? "border-green-200 bg-green-50"
              : savedButOff
                ? "border-honey/50 bg-honey/5"
                : "border-border bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {connected ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" />
              ) : (
                <HelpCircle className="mt-0.5 size-6 shrink-0 text-honey" />
              )}
              <div>
                <div className="font-bold text-ink">
                  {connected
                    ? "GTM সংযোগ স্থাপিত ✓ ওয়েবসাইটে চালু আছে"
                    : savedButOff
                      ? "GTM বন্ধ আছে — Container ID সংরক্ষিত আছে"
                      : "এখনো GTM সংযোগ হয়নি"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {connected ? (
                    <>
                      Container ID:{" "}
                      <span className="font-mono font-bold text-ink">
                        {saved.containerId}
                      </span>{" "}
                      • dataLayer ইভেন্ট:{" "}
                      <b className="text-ink">
                        {GTM_EVENT_IDS.filter((id) => saved.events[id]).length}টি
                      </b>
                    </>
                  ) : savedButOff ? (
                    <>
                      সংরক্ষিত ID:{" "}
                      <span className="font-mono font-bold text-ink">
                        {saved.containerId}
                      </span>
                    </>
                  ) : (
                    "নিচের ধাপে Container ID পেস্ট করে সংযোগ করুন।"
                  )}
                </div>
              </div>
            </div>
            {savedButOff && (
              <Button
                onClick={connect}
                disabled={busy !== null}
                className="rounded-full bg-green-600 font-bold text-white hover:bg-green-700"
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
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-green-600 text-sm font-bold text-white">
              ১
            </div>
            <div>
              <h2 className="font-bold text-ink">GTM Container ID দিন</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Google Tag Manager থেকে <b>GTM-XXXXXXX</b> ফরম্যাটের ID কপি করে নিচে পেস্ট করুন।
              </p>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            spellCheck={false}
            dir="ltr"
            placeholder={`যেমন: GTM-XXXXXXX\n\nঅথবা GTM স্ক্রিপ্ট কোড পেস্ট করুন`}
            className="mt-4 w-full rounded-xl border border-border bg-cream/60 p-3.5 font-mono text-xs leading-relaxed text-ink outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 sm:text-sm"
          />

          {input.trim() !== "" && (
            <div
              className={`mt-2.5 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                detected
                  ? "border-green-200 bg-green-50 text-ink"
                  : "border-red-200 bg-red-50 text-ink"
              }`}
            >
              {detected ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              )}
              {detected ? (
                <span>
                  Container ID ডিটেক্ট হয়েছে:{" "}
                  <span className="font-mono font-bold">{detected}</span>
                </span>
              ) : (
                <span>GTM-XXXXXXX ফরম্যাটে ID দিন।</span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              onClick={connect}
              disabled={
                busy !== null || connected || (!detected && !saved.containerId)
              }
              className="rounded-full bg-green-600 font-bold text-white shadow-lg shadow-green-600/25 hover:bg-green-700 disabled:opacity-60"
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
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green-600" />
            সংযোগ করার সাথে সাথেই ল্যান্ডিং পেজে GTM লোড হবে।
          </p>
        </section>

        {/* Step 2: Events */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-green-600 text-sm font-bold text-white">
                ২
              </div>
              <div>
                <h2 className="font-bold text-ink">dataLayer ইভেন্ট</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  কোন কোন ইভেন্ট GTM-এ dataLayer-এ পাঠানো হবে তা বেছে নিন।
                </p>
              </div>
            </div>
            <Button
              onClick={saveEvents}
              disabled={busy !== null || !eventsDirty}
              className="rounded-full bg-green-600 font-bold text-white hover:bg-green-700 disabled:opacity-60"
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
            {GTM_EVENT_IDS.map((id: GtmEventId) => {
              const meta = GTM_EVENT_META[id];
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
                    className="shrink-0 data-[state=checked]:bg-green-600"
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

        {/* Help */}
        <section className="rounded-2xl border border-dashed border-border bg-white/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <h2 className="font-bold text-ink">GTM Container ID কোথায় পাবেন?</h2>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <b className="text-ink">১.</b>{" "}
                  <a
                    href="https://tagmanager.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-green-600 hover:underline"
                  >
                    Google Tag Manager
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  এ যান (আপনার Google অ্যাকাউন্ট দিয়ে)।
                </li>
                <li>
                  <b className="text-ink">২.</b> <b className="text-ink">Create Account</b> চাপুন, ওয়েবসাইটের URL দিন।
                </li>
                <li>
                  <b className="text-ink">৩.</b> <b className="text-ink">Install GTM</b> থেকে <b className="text-ink">"Copy to clipboard"</b> করে নিচে পেস্ট করুন — অথবা শুধু Container ID (GTM-XXXXXXX) দিন।
                </li>
                <li>
                  <b className="text-ink">৪.</b> এখানে <b className="text-ink">সংযোগ করুন</b> চাপুন — ব্যস!
                </li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
