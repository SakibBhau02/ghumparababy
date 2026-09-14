"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  type FraudCheckResult,
  type FraudConfig,
  COURIER_META,
  ALL_COURIER_IDS,
  RISK_META,
  riskLevel,
} from "@/lib/fraud-shared";
import { toBn } from "@/lib/landing-data";
import { FraudResultDetails } from "@/components/admin/fraud-badge";
import {
  CheckCircle2,
  HelpCircle,
  Loader2,
  Save,
  Search,
} from "lucide-react";

/**
 * Fraud checker admin setup — credentials + FraudBD fallback + phone check.
 */
export function FraudChecker({ initialConfig }: { initialConfig: FraudConfig }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<FraudConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FraudCheckResult | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fraud", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fraud: config }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "সেভ হয়নি", description: data.error, variant: "destructive" });
        return;
      }
      setConfig(data.fraud);
      toast({ title: "Fraud checker সেভ হয়েছে ✓" });
    } catch {
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const check = async (fresh = false) => {
    const digits = phone.replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(digits)) {
      toast({ title: "সঠিক ১১ ডিজিটের নম্বর দিন", variant: "destructive" });
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/fraud?phone=${digits}${fresh ? "&fresh=1" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Check ব্যর্থ", description: data.error, variant: "destructive" });
        return;
      }
      setResult(data.result);
    } catch {
      toast({ title: "নেটওয়ার্ক সমস্যা", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const risk = result ? riskLevel(result.aggregated.successRatio, result.aggregated.total) : "none";
  const riskMeta = RISK_META[risk];
  const credCount = Object.keys(config.credentials).length;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`rounded-2xl border p-5 ${
        config.enabled
          ? "border-green-200 bg-green-50"
          : "border-border bg-white"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {config.enabled ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" />
            ) : (
              <HelpCircle className="mt-0.5 size-6 shrink-0 text-amber-500" />
            )}
            <div>
              <div className="font-bold text-ink">
                {config.enabled
                  ? `Fraud Checker চালু ✓ — ${toBn(credCount)}টি কুরিয়ার কনফিগার্ড${config.fraudbdFallback && config.fraudbdApiKey ? " + FraudBD ব্যাকআপ" : ""}`
                  : "Fraud Checker বন্ধ আছে"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {config.enabled
                  ? "নতুন অর্ডার আগে কাস্টমারের ফোন নম্বর দিয়ে courier history চেক করুন।"
                  : "নিচের কুরিয়ারগুলোর credentials বসিয়ে সেভ করুন।"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credentials */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
            ১
          </div>
          <div>
            <h2 className="font-bold text-ink">কুরিয়ার credentials</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              যেসব কুরিয়ারের merchant account আছে, সেগুলোর login দিন।
              যেগুলো দেবেন না, সেগুলো skip হয়ে যাবে (বা FraudBD থেকে আসবে)।
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ALL_COURIER_IDS.map((id) => {
            const meta = COURIER_META[id];
            const cred = config.credentials[id] ?? { user: "", password: "" };
            const hasCred = cred.user.length > 0 && cred.password.length > 0;
            return (
              <div
                key={id}
                className={`rounded-xl border p-3.5 ${
                  hasCred
                    ? "border-green-200 bg-green-50"
                    : "border-border bg-cream/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${meta.color}`}>
                      {meta.label}
                    </span>
                    {hasCred && <CheckCircle2 className="size-4 text-green-600" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{meta.requires}</span>
                </div>
                <input
                  value={cred.user}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      credentials: {
                        ...c.credentials,
                        [id]: { ...cred, user: e.target.value },
                      },
                    }))
                  }
                  placeholder={`${meta.label} ${id === "redx" || id === "carrybee" ? "ফোন (01…)" : id === "paperfly" ? "username" : "email"}`}
                  className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="password"
                  value={cred.password}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      credentials: {
                        ...c.credentials,
                        [id]: { ...cred, password: e.target.value },
                      },
                    }))
                  }
                  placeholder="Password"
                  autoComplete="new-password"
                  className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5">
            <div>
              <div className="text-sm font-semibold text-ink">Fraud Checker {config.enabled ? "চালু" : "বন্ধ"}</div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5">
            <div>
              <div className="text-sm font-semibold text-ink">নতুন অর্ডারে অটো-চেক {config.autoCheck ? "চালু" : "বন্ধ"}</div>
              <p className="text-[11px] text-muted-foreground">অর্ডার row-তে risk badge + customer পেজে history</p>
            </div>
            <Switch
              checked={config.autoCheck}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, autoCheck: v }))}
            />
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-4" />
            )}
            সেভ করুন
          </Button>
        </div>
      </section>

      {/* FraudBD fallback */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
            ২
          </div>
          <div>
            <h2 className="font-bold text-ink">FraudBD ব্যাকআপ (merchant account না থাকলে)</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              fraudbd.com থেকে API key নিয়ে বসান — যেসব কুরিয়ারের login দেননি বা login fail
              করেছে, সেগুলোর ডেটা FraudBD থেকে আসবে।
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <input
            value={config.fraudbdApiKey}
            onChange={(e) => setConfig((c) => ({ ...c, fraudbdApiKey: e.target.value }))}
            placeholder="FraudBD API key (account settings থেকে)"
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-border bg-cream/60 px-4 font-mono text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5">
              <div className="text-sm font-semibold text-ink">FraudBD fallback {config.fraudbdFallback ? "চালু" : "বন্ধ"}</div>
              <Switch
                checked={config.fraudbdFallback}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, fraudbdFallback: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5">
              <div>
                <div className="text-sm font-semibold text-ink">Sandbox mode</div>
                <p className="text-[11px] text-muted-foreground">টেস্ট key দিয়ে যাচাই করতে</p>
              </div>
              <Switch
                checked={config.fraudbdSandbox}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, fraudbdSandbox: v }))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Phone Check */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
            ৩
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-ink">ফোন নম্বর চেক করুন</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              কাস্টমারের ১১ ডিজিটের নম্বর দিন — সব কনফিগার্ড কুরিয়ারে চেক হবে।
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={phone}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 11);
              setPhone(v);
            }}
            placeholder="01XXXXXXXXX"
            dir="ltr"
            maxLength={11}
            className="h-11 flex-1 rounded-xl border border-border bg-cream/60 px-4 font-mono text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <Button
            onClick={() => check(false)}
            disabled={checking || phone.length < 11}
            className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {checking ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 size-4" />
            )}
            চেক করুন
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4 space-y-3">
            <div className={`flex items-center gap-3 rounded-xl border p-4 ${riskMeta.badge.split(" ")[0]} ${riskMeta.badge.split(" ")[1]}`}>
              <span className="text-2xl">{riskMeta.emoji}</span>
              <div className="flex-1">
                <div className="font-bold">
                  {riskMeta.label} — মোট {toBn(result.aggregated.total)}টি অর্ডার
                </div>
                <div className="text-sm opacity-80">
                  {toBn(result.aggregated.delivered)} ডেলিভারড / {toBn(result.aggregated.cancelled)} বাতিল —
                  সফলতা: {toBn(result.aggregated.successRatio)}%
                </div>
              </div>
              <button
                onClick={() => check(true)}
                disabled={checking}
                title="Cache মুছে fresh চেক করুন"
                className="shrink-0 rounded-full border border-current px-3 py-1 text-xs font-bold opacity-70 hover:opacity-100 disabled:opacity-40"
              >
                ↻ Fresh
              </button>
            </div>

            <FraudResultDetails result={result} />
          </div>
        )}
      </section>

      {/* Help */}
      <section className="rounded-2xl border border-dashed border-border bg-white/70 p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p><b className="text-ink">কীভাবে কাজ করে?</b></p>
            <ul className="mt-2 space-y-1">
              <li>• প্রতিটা কুরিয়ারের merchant login দিয়ে সেই কুরিয়ারের ডেটাবেজ থেকে delivery history আসে।</li>
              <li>• RedX-এর জন্যও merchant API পথে automation চলে (OTP লাগে না)।</li>
              <li>• Pathao এখন সংখ্যার বদলে rating দেয় (চমৎকার/ভালো/ফ্রড কাস্টমার) — ওটাই দেখানো হয়।</li>
              <li>• Login প্রতি ~৫০ মিনিট cache থাকে, রেজাল্ট ১২ ঘণ্টা cache থাকে (Fresh দিয়ে নতুন চেক)।</li>
              <li>• Success ratio ৮০%+ = নিরাপদ, ৫০-৮০% = সতর্ক, ৫০%-এর নিচে = ঝুঁকিপূর্ণ।</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
