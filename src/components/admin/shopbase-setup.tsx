"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, RefreshCw, Save, ShoppingBag } from "lucide-react";
import {
  DEFAULT_SKUS,
  type ShopbaseConfig,
} from "@/lib/shopbase-shared";
import { PRODUCT_COLORS, toBn } from "@/lib/landing-data";

/**
 * ShopBase BD fulfillment setup — self-contained admin section.
 * Test token 123456 verifies connectivity via a TEST order; a live token
 * is issued by ShopBase after successful testing.
 */
export function ShopbaseSetup({ initial }: { initial: ShopbaseConfig }) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<ShopbaseConfig>(initial);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [isTestToken, setIsTestToken] = useState(
    initial.token === "123456" || initial.token === ""
  );

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/shopbase/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inputs.token, skus: inputs.skus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "টেস্ট হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setInputs(data.shopbase);
      setIsTestToken(inputs.token === "123456");
      toast({
        title: "ShopBase Connected ✓",
        description: `টেস্ট অর্ডার সফল (ID: ${data.sbrOrderId}) — এখন one-click-এ অর্ডার পাঠাতে পারবেন।`,
      });
    } catch {
      toast({ title: "টেস্ট ব্যর্থ", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const toggle = async (v: boolean) => {
    const next = { ...inputs, enabled: v };
    const prev = inputs;
    setInputs(next);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopbase: next }),
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
      setInputs(data.shopbase);
    } catch {
      setInputs(prev);
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    }
  };

  const saveSkus = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopbase: inputs }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "সেভ হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setInputs(data.shopbase);
      toast({ title: "SKU সেভ হয়েছে ✓" });
    } catch {
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-indigo-300/60 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-indigo-600" />
          <div>
            <h2 className="font-bold text-ink">
              ShopBase BD ফুলফিলমেন্ট{" "}
              {inputs.enabled && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  Connected ✓
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              One-click-এ অর্ডার ShopBase BD-তে যাবে — কালার-ভাগ অনুযায়ী SKU সহ।
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={test}
            disabled={testing}
            className="rounded-full bg-indigo-600 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {testing ? (
              <>
                <RefreshCw className="mr-1.5 size-4 animate-spin" /> টেস্ট হচ্ছে...
              </>
            ) : (
              "টেস্ট করুন"
            )}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { done: inputs.token.length > 0, label: "১. টোকেন বসানো" },
          { done: Object.values(inputs.skus).every((s) => s.length > 0), label: "২. SKU বসানো" },
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

      <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex w-full items-center justify-between gap-2 bg-indigo-50 px-4 py-3 text-left text-sm font-bold text-ink hover:bg-indigo-100/60"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 text-indigo-600" />
            📖 সেটআপ গাইড — ধাপে ধাপে
          </span>
          <span className="text-indigo-600">{showGuide ? "▲" : "▼"}</span>
        </button>
        {showGuide && (
          <ol className="space-y-4 bg-white p-4 text-sm leading-relaxed text-ink">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">১</span>
              <div>
                <b>টেস্ট টোকেন দিয়ে শুরু:</b> টোকেন ঘরে <code className="rounded bg-cream px-1">123456</code> লিখে <b>টেস্ট করুন</b> চাপুন — একটা TEST অর্ডার যাবে, সফল হলে Connected হবে।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">২</span>
              <div>
                <b>লাইভ টোকেন নিন:</b> টেস্ট সফল হলে ShopBase BD থেকে লাইভ টোকেন পাবেন — সেটা বসিয়ে আবার <b>টেস্ট করুন</b> চাপুন।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">৩</span>
              <div>
                <b>SKU মিলিয়ে নিন:</b> নিচের ৪টা SKU ShopBase-এর পণ্যের সাথে মিলতে হবে — ভুল হলে অর্ডার যাবে না।
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">৪</span>
              <div>
                <b>One-click পাঠান:</b> প্রতিটা অর্ডারের পাশে <b>🛍️ বাটন</b> চাপুন → ShopBase ID ব্যাজে দেখাবে। দুবার চাপলেও ডাবল অর্ডার হবে না।
              </div>
            </li>
          </ol>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
          <div>
            <div className="text-sm font-semibold text-ink">ShopBase {inputs.enabled ? "চালু" : "বন্ধ"}</div>
            <p className="text-xs text-muted-foreground">টেস্ট সফল হলেই অটো চালু হয়ে যাবে।</p>
          </div>
          <Switch checked={inputs.enabled} onCheckedChange={toggle} />
        </div>
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <label className="text-sm font-semibold text-ink">API টোকেন *</label>
          <input
            type="password"
            value={inputs.token}
            onChange={(e) => {
              setInputs((cur) => ({ ...cur, token: e.target.value }));
              setIsTestToken(e.target.value === "123456");
            }}
            placeholder="123456 (টেস্ট) বা লাইভ টোকেন"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {isTestToken
              ? "⚠️ এটা টেস্ট টোকেন — লাইভ অর্ডারের আগে লাইভ টোকেন বসান।"
              : "লাইভ টোকেন — গোপন রাখুন।"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-cream/50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-semibold text-ink">কালার-ভাগ SKU *</label>
            <Button
              onClick={saveSkus}
              disabled={saving}
              size="sm"
              className="rounded-full bg-indigo-600 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 size-3.5" />
              )}
              সেভ করুন
            </Button>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {PRODUCT_COLORS.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span
                  className="size-3.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: c.hex }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputs.skus[c.id] ?? ""}
                  onChange={(e) =>
                    setInputs((cur) => ({
                      ...cur,
                      skus: { ...cur.skus, [c.id]: e.target.value.trim() },
                    }))
                  }
                  placeholder={`SKU ${toBn(PRODUCT_COLORS.findIndex((x) => x.id === c.id) + 1)}`}
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm font-mono text-ink outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ShopBase-এ যাওয়া মাত্রা: {PRODUCT_COLORS.map((c) => `${c.label}=${inputs.skus[c.id] || "—"}`).join(" • ")}
          </p>
        </div>
      </div>
    </div>
  );
}
