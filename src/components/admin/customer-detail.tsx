"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { toBn } from "@/lib/landing-data";
import {
  codStats,
  parseTags,
  PRESET_TAGS,
  SEGMENTS,
  segmentOf,
} from "@/lib/customer-segments";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  Search,
  ShieldCheck,
  Tag as TagIcon,
  X,
} from "lucide-react";
import {
  type FraudCheckResult,
  RISK_META,
  riskLevel,
} from "@/lib/fraud-shared";
import { FraudResultDetails } from "@/components/admin/fraud-badge";

type OrderRow = {
  id: string;
  orderCode: string;
  packageName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  colors: string;
  color: string;
  shopbaseOrderId: string;
  createdAt: string | Date;
};

type CustomerRow = {
  phone: string;
  name: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  email: string;
  tags: string;
  note: string;
  blacklisted: boolean;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string | Date;
  lastOrderAt: string | Date;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "পেন্ডিং",
  confirmed: "কনফার্মড",
  shipped: "শিপমেন্টে",
  delivered: "ডেলিভারড",
  cancelled: "বাতিল",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-sky-100 text-sky-800 border-sky-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function fmtDate(value: string | Date): string {
  return new Date(value).toLocaleString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function orderColorsLabel(o: OrderRow, labels?: Record<string, string> | null): string {
  const labelOf = (id: string) => labels?.[id] ?? id;
  try {
    const arr = JSON.parse(o.colors) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .map((c) => labelOf(String(c)))
        .join(", ");
    }
  } catch {
    // fall through
  }
  return labelOf(o.color);
}

export function CustomerDetail({
  customer: initial,
  orders: initialOrders,
  colorLabels,
}: {
  customer: CustomerRow;
  orders: OrderRow[];
  /** Live variant id → Bangla label (server-built from catalog). */
  colorLabels?: Record<string, string> | null;
}) {
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerRow>(initial);
  const [tags, setTags] = useState<string[]>(parseTags(initial.tags));
  const [note, setNote] = useState(initial.note);
  const [email, setEmail] = useState(initial.email);
  const [blacklisted, setBlacklisted] = useState(initial.blacklisted);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [fraudResult, setFraudResult] = useState<FraudCheckResult | null>(null);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [pushingId, setPushingId] = useState<string | null>(null);

  /** One-click ShopBase push from the profile page (same API as dashboard). */
  const pushToShopbase = async (orderId: string) => {
    setPushingId(orderId);
    try {
      const res = await fetch("/api/admin/shopbase/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: "ShopBase-এ যায়নি",
          description: data?.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setOrders((cur) =>
        cur.map((o) => (o.id === orderId ? { ...o, shopbaseOrderId: data?.shopbaseOrderId ?? "" } : o))
      );
      toast({ title: "ShopBase-এ অর্ডার গেছে ✓", description: `ShopBase ID: ${data?.shopbaseOrderId ?? ""}` });
    } catch {
      toast({ title: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setPushingId(null);
    }
  };

  const segment = segmentOf(customer);
  const seg = SEGMENTS[segment];
  const cod = codStats(orders);
  const aov = customer.orderCount > 0 ? Math.round(customer.totalSpent / customer.orderCount) : 0;
  const loc = [customer.division, customer.district, customer.upazila]
    .filter(Boolean)
    .join(", ");

  const togglePresetTag = (t: string) => {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };
  const addCustomTag = () => {
    const t = newTag.trim().slice(0, 30);
    if (!t || tags.includes(t) || tags.length >= 10) return;
    setTags((cur) => [...cur, t]);
    setNewTag("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customer.phone,
          patch: { tags, note, email, blacklisted },
        }),
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
      setCustomer(data.customer);
      toast({
        title: "প্রোফাইল সেভ হয়েছে ✓",
        description: blacklisted ? "এই নম্বর এখন নতুন অর্ডার দিতে পারবে না।" : undefined,
      });
    } catch {
      toast({ title: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const lowSuccess = cod.rate !== null && cod.rate < 60;

  const checkFraud = async () => {
    setFraudLoading(true);
    try {
      const res = await fetch(`/api/admin/fraud?phone=${customer.phone}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Check ব্যর্থ", description: data.error, variant: "destructive" });
        return;
      }
      setFraudResult(data.result);
    } catch {
      toast({ title: "নেটওয়ার্ক সমস্যা", variant: "destructive" });
    } finally {
      setFraudLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream/60 px-4 pb-12 pt-6 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline"
        >
          <ArrowLeft className="size-4" /> অ্যাডমিন প্যানেলে ফিরুন
        </Link>

        {/* Header card */}
        <div className="mt-4 rounded-[2rem] border border-border bg-white p-6 shadow-xl shadow-brand/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">
                  {customer.name || "(নাম নেই)"}
                </h1>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${seg.badge}`}>
                  {seg.label}
                </span>
                {customer.blacklisted && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                    <Ban className="size-3" /> অর্ডার বন্ধ
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{customer.phone}</p>
              {customer.email && (
                <p className="text-sm text-muted-foreground">✉️ {customer.email}</p>
              )}
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft/60 px-2 py-0.5 text-xs font-bold text-brand-deep"
                    >
                      <TagIcon className="size-3" /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-full font-bold"
                onClick={() => window.open(`tel:+88${customer.phone}`, "_self")}
              >
                <Phone className="mr-1.5 size-4" /> কল
              </Button>
              <Button
                variant="outline"
                className="rounded-full font-bold text-emerald-700"
                onClick={() => window.open(`https://wa.me/88${customer.phone}`, "_blank")}
              >
                <MessageCircle className="mr-1.5 size-4" /> WhatsApp
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {[
              { label: "মোট অর্ডার", value: `${toBn(customer.orderCount)}টি` },
              { label: "মোট খরচ", value: `৳${toBn(customer.totalSpent)}` },
              { label: "গড় অর্ডার (AOV)", value: `৳${toBn(aov)}` },
              {
                label: "ডেলিভারি সফলতা",
                value:
                  cod.rate === null
                    ? "—"
                    : `${toBn(cod.rate)}%`,
                warn: lowSuccess,
                sub:
                  cod.rate === null
                    ? "সম্পন্ন অর্ডার নেই"
                    : `${toBn(cod.delivered)} ডেলিভারড / ${toBn(cod.cancelled)} বাতিল`,
              },
              {
                label: "শেষ অর্ডার",
                value: fmtDate(customer.lastOrderAt).split(",")[0],
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl border p-3 ${
                  s.warn
                    ? "border-red-200 bg-red-50"
                    : "border-border bg-cream/50"
                }`}
              >
                <div className="text-[11px] font-semibold text-muted-foreground">{s.label}</div>
                <div className={`mt-1 text-lg font-bold ${s.warn ? "text-red-700" : "text-ink"}`}>
                  {s.value}
                </div>
                {s.sub && (
                  <div className={`text-[11px] ${s.warn ? "text-red-600" : "text-muted-foreground"}`}>
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
          {lowSuccess && cod.rate !== null && (
            <p className="mt-2.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              ⚠️ এই কাস্টমারের বাতিলের হার বেশি ({toBn(cod.rate)}%) — COD-তে ঝুঁকিপূর্ণ।
              চাইলে নিচে ব্ল্যাকলিস্ট করে দিন।
            </p>
          )}

          {/* Fraud Check */}
          <div id="fraud" className="mt-4 flex scroll-mt-4 flex-wrap items-center gap-2">
            <Button
              onClick={checkFraud}
              disabled={fraudLoading}
              variant="outline"
              className="rounded-full font-bold"
            >
              {fraudLoading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 size-4 text-brand" />
              )}
              কুরিয়ার Fraud Check
            </Button>
            {fraudResult && (() => {
              const risk = riskLevel(fraudResult.aggregated.successRatio, fraudResult.aggregated.total);
              const rm = RISK_META[risk];
              return (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${rm.badge}`}>
                  {rm.emoji} {rm.label}
                  {risk !== "none" && ` — ${toBn(fraudResult.aggregated.successRatio)}%`}
                </span>
              );
            })()}
          </div>

          {fraudResult && (
            <div className="mt-3">
              <FraudResultDetails result={fraudResult} />
            </div>
          )}

          {/* Info */}
          <div className="mt-4 space-y-1 text-sm text-ink">
            {customer.address && <p>🏠 {customer.address}</p>}
            {loc && <p className="text-muted-foreground">📍 {loc}</p>}
            <p className="text-xs text-muted-foreground">
              প্রথম অর্ডার: {fmtDate(customer.firstOrderAt)} • শেষ: {fmtDate(customer.lastOrderAt)}
            </p>
          </div>
        </div>

        {/* Editor card */}
        <div className="mt-5 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h2 className="font-bold text-ink">প্রোফাইল এডিট (admin)</h2>

          <div className="mt-4">
            <label className="text-sm font-semibold text-ink">ট্যাগ</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => togglePresetTag(t)}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                      on
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white text-muted-foreground hover:border-brand/40"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
              {tags
                .filter((t) => !PRESET_TAGS.includes(t))
                .map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand px-3 py-1 text-xs font-bold text-white"
                  >
                    {t}
                    <button type="button" onClick={() => setTags((cur) => cur.filter((x) => x !== t))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="নতুন ট্যাগ লিখে Enter দিন…"
                maxLength={30}
                className="h-9 flex-1 rounded-full border border-border bg-white px-4 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-ink">
              📝 নোট{" "}
              <span className="font-normal text-muted-foreground">
                (শুধু আপনার জন্য — কাস্টমার দেখবে না)
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="যেমন: ৩টা কল ধরেনি, রাতে কল দিতে হবে / গিফট বান্ধতে বলেছিল…"
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-ink">ইমেইল (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5">
              <div>
                <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Ban className="size-4 text-red-600" /> ব্ল্যাকলিস্ট
                </div>
                <p className="text-xs text-muted-foreground">
                  চালু করলে এই নম্বর থেকে নতুন অর্ডার যাবে না।
                </p>
              </div>
              <Switch checked={blacklisted} onCheckedChange={setBlacklisted} />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" /> সেভ হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 size-4" /> সেভ করুন
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Orders timeline */}
        <div className="mt-5 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h2 className="font-bold text-ink">
            অর্ডার হিস্টোরি ({toBn(orders.length)})
          </h2>
          <div className="mt-4 space-y-2.5">
            {orders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                কোনো অর্ডার নেই।
              </p>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-cream/40 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-ink">{o.orderCode}</span>
                    {o.shopbaseOrderId ? (
                      <span
                        title="ShopBase BD-তে পাঠানো হয়েছে"
                        className="ml-2 rounded-lg bg-indigo-100 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-800"
                      >
                        🛍️ {o.shopbaseOrderId}
                      </span>
                    ) : null}
                    <span className="ml-2 text-muted-foreground">
                      {o.packageName} • {orderColorsLabel(o, colorLabels)}
                    </span>
                    <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-brand">৳{toBn(o.totalPrice)}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        STATUS_BADGE[o.status] ?? STATUS_BADGE.pending
                      }`}
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    {!o.shopbaseOrderId ? (
                      <button
                        type="button"
                        onClick={() => pushToShopbase(o.id)}
                        disabled={pushingId === o.id}
                        title="ShopBase BD-তে পাঠান"
                        className="grid size-8 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-indigo-500 hover:text-indigo-600 disabled:opacity-60"
                      >
                        {pushingId === o.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <span className="text-sm">🛍️</span>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
