"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Copy, PhoneOutgoing, RefreshCw } from "lucide-react";
import { type ManyDialConfig } from "@/lib/manydial-shared";

const OWNER_FIELDS = [
  { k: "ownerName", label: "মালিকের পুরো নাম *", ph: "আব্দুল করিম", type: "text" },
  { k: "businessName", label: "ব্যবসার নাম *", ph: "ঘুমপাড়া বেবি", type: "text" },
  { k: "email", label: "ইমেইল *", ph: "owner@example.com", type: "email" },
  { k: "phone", label: "মালিকের ফোন *", ph: "+8801XXXXXXXXX", type: "tel" },
  { k: "nid", label: "এনআইডি নম্বর *", ph: "1999000000000", type: "text" },
  { k: "dob", label: "জন্মতারিখ * (YYYY-MM-DD)", ph: "1980-05-20", type: "date" },
  { k: "fatherName", label: "পিতার নাম *", ph: "মোহাম্মদ রহিম", type: "text" },
  { k: "motherName", label: "মাতার নাম *", ph: "রহিমা বেগম", type: "text" },
] as const;

const ADDRESS_FIELDS = [
  { k: "flatNo", label: "ফ্ল্যাট নং *" },
  { k: "houseNoOrName", label: "বাড়ি নং/নাম *" },
  { k: "roadNoOrMoholla", label: "রোড/মহল্লা *" },
  { k: "areaOrVillage", label: "এলাকা/গ্রাম *" },
  { k: "division", label: "বিভাগ *" },
  { k: "district", label: "জেলা *" },
  { k: "upazilaOrThana", label: "উপজেলা/থানা *" },
  { k: "postCode", label: "পোস্ট কোড *" },
] as const;

const IMAGE_FIELDS = [
  { k: "passportSizeImage", label: "পাসপোর্ট সাইজ ছবি (মালিকের) *" },
  { k: "signature", label: "স্বাক্ষরের ছবি *" },
  { k: "seal", label: "ব্যবসার সিল/স্ট্যাম্পের ছবি *" },
] as const;

type CallerIdForm = Record<string, string>;

/**
 * ManyDial call-automation setup — self-contained admin section.
 * Includes the one-time Caller ID request form (verification for a
 * dedicated caller number).
 */
export function ManyDialSetup({ initial }: { initial: ManyDialConfig }) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<ManyDialConfig>(initial);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [showCallerIdForm, setShowCallerIdForm] = useState(false);
  const [cidForm, setCidForm] = useState<CallerIdForm>({ gender: "Male" });
  const [cidSending, setCidSending] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedHook, setCopiedHook] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const webhookUrl =
    origin && inputs.webhookSecret
      ? `${origin}/api/manydial/webhook?secret=${inputs.webhookSecret}`
      : "";

  const copyHook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedHook(true);
      setTimeout(() => setCopiedHook(false), 1500);
    } catch {
      toast({ title: "কপি হয়নি — নিজে সিলেক্ট করে কপি করুন।", variant: "destructive" });
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/manydial/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: inputs.apiKey,
          callerId: inputs.callerId,
          testPhone,
          webhookSecret: inputs.webhookSecret,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "টেস্ট কল যায়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setInputs(data.manydial);
      toast({
        title: "ManyDial Connected ✓",
        description: `টেস্ট কল ${testPhone} নম্বরে গেছে — কল ধরে ১ চাপলে Telegram-এ রেজাল্ট আসবে।`,
      });
    } catch {
      toast({ title: "টেস্ট ব্যর্থ", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const save = async (patch: Partial<ManyDialConfig>) => {
    const next = { ...inputs, ...patch };
    const prev = inputs;
    setInputs(next);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manydial: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInputs(prev);
        toast({
          title: "সেভ হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setInputs(data.manydial);
    } catch {
      setInputs(prev);
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    }
  };

  const pickImage = (k: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "ছবি ৩ MB-র কম হতে হবে।", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setCidForm((cur) => ({ ...cur, [k]: String(reader.result ?? "") }));
    reader.readAsDataURL(file);
  };

  const submitCallerId = async () => {
    setCidSending(true);
    try {
      const res = await fetch("/api/admin/manydial/caller-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: inputs.apiKey, form: cidForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "রিকোয়েস্ট যায়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Caller ID রিকোয়েস্ট পাঠানো হয়েছে ✓",
        description: "Approve/Reject খবর Telegram-এ আসবে। Approve হলে নম্বরটা উপরে Caller ID ঘরে বসান।",
      });
      setShowCallerIdForm(false);
    } catch {
      toast({ title: "রিকোয়েস্ট ব্যর্থ", variant: "destructive" });
    } finally {
      setCidSending(false);
    }
  };

  const field = (k: string, label: string, ph: string, type = "text") => (
    <div key={k}>
      <label className="text-xs font-semibold text-ink">{label}</label>
      <input
        type={type}
        value={cidForm[k] ?? ""}
        onChange={(e) => setCidForm((cur) => ({ ...cur, [k]: e.target.value }))}
        placeholder={ph}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border border-teal-300/60 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PhoneOutgoing className="size-5 text-teal-600" />
          <div>
            <h2 className="font-bold text-ink">
              ManyDial কনফার্মেশন কল{" "}
              {inputs.enabled && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  Connected ✓
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              নতুন অর্ডারে অটো ভয়েস কল — কাস্টমার ১ চাপলে কনফার্ম, ২ চাপলে বাতিল।
            </p>
          </div>
        </div>
        <Button
          onClick={test}
          disabled={testing}
          className="rounded-full bg-teal-600 font-bold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {testing ? (
            <>
              <RefreshCw className="mr-1.5 size-4 animate-spin" /> কল যাচ্ছে...
            </>
          ) : (
            "টেস্ট কল দিন"
          )}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { done: inputs.apiKey.length > 0, label: "১. API key বসানো" },
          { done: inputs.callerId.length > 0, label: "২. Caller ID বসানো" },
          { done: inputs.enabled, label: "৩. Connected" },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
              s.done
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-border bg-cream/50 text-muted-foreground"
            }`}
          >
            {s.done ? "✓ " : "○ "}
            {s.label}
          </div>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-teal-200">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex w-full items-center justify-between gap-2 bg-teal-50 px-4 py-3 text-left text-sm font-bold text-ink hover:bg-teal-100/60"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 text-teal-600" />
            📖 সেটআপ গাইড — ধাপে ধাপে
          </span>
          <span className="text-teal-600">{showGuide ? "▲" : "▼"}</span>
        </button>
        {showGuide && (
          <ol className="space-y-4 bg-white p-4 text-sm leading-relaxed text-ink">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">১</span>
              <div>
                <b>অ্যাকাউন্ট খুলুন:</b>{" "}
                <a href="https://www.manydial.com" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline">
                  manydial.com
                </a>{" "}
                — পোর্টাল থেকে <b>x-api-key</b> নিন।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">২</span>
              <div>
                <b>Caller ID নিন (একবারই):</b> নিচের{" "}
                <button
                  type="button"
                  onClick={() => setShowCallerIdForm(true)}
                  className="font-bold text-teal-700 underline"
                >
                  Caller ID রিকোয়েস্ট ফর্ম
                </button>{" "}
                পূরণ করুন — এনআইডি + ছবি লাগবে। Approve হলে নম্বরটাই আপনার Caller ID।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">৩</span>
              <div>
                <b>টেস্ট কল:</b> API key + Caller ID + নিজের নম্বর দিয়ে <b>টেস্ট কল দিন</b> — কল এলে ১ চাপলে Telegram-এ ✅ খবর আসবে।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">৪</span>
              <div>
                <b>অটো-কল চালু:</b> এরপর প্রতিটা নতুন অর্ডারে কাস্টমারকে অটো কল যাবে — রেজাল্ট অর্ডার স্ট্যাটাসে + Telegram-এ। কল ধরা না পড়লে অর্ডার কার্ডের 📞 বাটনে আবার পাঠান।
              </div>
            </li>
          </ol>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <label className="text-sm font-semibold text-ink">x-api-key *</label>
          <input
            type="password"
            value={inputs.apiKey}
            onChange={(e) => setInputs((cur) => ({ ...cur, apiKey: e.target.value }))}
            placeholder="ManyDial পোর্টাল থেকে x-api-key"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">Key গোপন রাখুন।</p>
        </div>
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <label className="text-sm font-semibold text-ink">Caller ID *</label>
          <input
            type="text"
            value={inputs.callerId}
            onChange={(e) => setInputs((cur) => ({ ...cur, callerId: e.target.value }))}
            placeholder="+8809600000000"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Caller ID না থাকলে নিচের ফর্ম থেকে রিকোয়েস্ট করুন।{" "}
            <button
              type="button"
              onClick={() => setShowCallerIdForm((v) => !v)}
              className="font-bold text-teal-700 underline"
            >
              {showCallerIdForm ? "ফর্ম লুকান" : "ফর্ম খুলুন"}
            </button>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <label className="text-sm font-semibold text-ink">টেস্ট নম্বর (নিজের নম্বর দিন)</label>
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">টেস্ট কল এখানেই যাবে (আসল কল, চার্জ পড়তে পারে)।</p>
        </div>
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <label className="text-sm font-semibold text-ink">Webhook URL (অটো, স্পর্শ করার দরকার নেই)</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={webhookUrl || "সেভ করলে অটো তৈরি হবে"}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-xs font-mono text-muted-foreground outline-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyHook}
              disabled={!webhookUrl}
              className="size-10 shrink-0"
              title="কপি"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {copiedHook ? "✓ কপি হয়েছে" : "কলের রেজাল্ট এই URL-এ আসে — সিক্রেটসহ অটো-ভেরিফাইড।"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
          <div>
            <div className="text-sm font-semibold text-ink">ManyDial {inputs.enabled ? "চালু" : "বন্ধ"}</div>
            <p className="text-xs text-muted-foreground">টেস্ট কল সফল হলেই অটো চালু হয়।</p>
          </div>
          <Switch
            checked={inputs.enabled}
            onCheckedChange={(v) => save({ enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
          <div>
            <div className="text-sm font-semibold text-ink">নতুন অর্ডারে অটো-কল {inputs.autoCall ? "চালু" : "বন্ধ"}</div>
            <p className="text-xs text-muted-foreground">
              বন্ধ করলে শুধু অর্ডার কার্ডের 📞 বাটনে ম্যানুয়াল কল যাবে।
            </p>
          </div>
          <Switch
            checked={inputs.autoCall}
            onCheckedChange={(v) => save({ autoCall: v })}
          />
        </div>
      </div>

      {showCallerIdForm && (
        <div className="mt-4 rounded-2xl border border-teal-200 bg-cream/40 p-4">
          <h3 className="font-bold text-ink">Caller ID রিকোয়েস্ট ফর্ম (একবারই দরকার)</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ManyDial-এ নিবেদিত নম্বর নিতে ভেরিফিকেশন লাগে। সব তথ্য দিন — ছবি তিনটা আপলোড করলে বসে যাবে।
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {OWNER_FIELDS.map((f) => field(f.k, f.label, f.ph, f.type))}
            <div>
              <label className="text-xs font-semibold text-ink">লিঙ্গ *</label>
              <select
                value={cidForm.gender ?? "Male"}
                onChange={(e) => setCidForm((cur) => ({ ...cur, gender: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-ink outline-none focus:border-teal-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {ADDRESS_FIELDS.map((f) => field(f.k, f.label, ""))}
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {IMAGE_FIELDS.map((f) => (
              <div key={f.k} className="rounded-xl border border-border bg-white p-3">
                <label className="text-xs font-semibold text-ink">{f.label}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={pickImage(f.k)}
                  className="mt-1.5 w-full text-xs text-muted-foreground file:mr-2 file:rounded-full file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                />
                {cidForm[f.k] && <p className="mt-1 text-xs font-bold text-emerald-600">✓ আপলোড হয়েছে</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={submitCallerId}
              disabled={cidSending || !inputs.apiKey}
              className="rounded-full bg-teal-600 font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {cidSending ? (
                <>
                  <RefreshCw className="mr-1.5 size-4 animate-spin" /> পাঠানো হচ্ছে...
                </>
              ) : (
                "রিকোয়েস্ট পাঠান"
              )}
            </Button>
            {!inputs.apiKey && (
              <span className="text-xs font-semibold text-destructive">আগে x-api-key বসান।</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
