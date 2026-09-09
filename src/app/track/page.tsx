"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toBn } from "@/lib/landing-data";
import { Loader2, PackageSearch, ArrowLeft } from "lucide-react";

const STATUS_BN: Record<string, { label: string; cls: string }> = {
  pending: { label: "পেন্ডিং", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  confirmed: { label: "কনফার্মড", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped: { label: "শিপমেন্টে", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  delivered: { label: "ডেলিভার্ড", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "বাতিল", cls: "bg-red-100 text-red-800 border-red-200" },
};

type TrackedOrder = {
  orderCode: string;
  name: string;
  packageName: string;
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
};

export default function TrackPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const res = await fetch(`/api/track?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "কিছু একটা সমস্যা হয়েছে।");
        return;
      }
      setOrders(data.orders);
      setSearched(true);
    } catch {
      setError("নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream/60 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="size-4" /> হোমে ফিরুন
        </Link>
        <div className="mt-4 rounded-[2rem] bg-white p-6 shadow-xl shadow-brand/10 sm:p-8">
          <div className="flex items-center gap-2">
            <PackageSearch className="size-6 text-brand" />
            <h1 className="text-2xl font-bold text-ink">অর্ডার ট্র্যাক করুন</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            অর্ডারের সময় দেওয়া মোবাইল নম্বরটি লিখুন।
          </p>
          <form onSubmit={search} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="track-phone" className="text-sm text-muted-foreground">
                মোবাইল নম্বর
              </Label>
              <Input
                id="track-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                required
                className="mt-1.5 h-12 rounded-xl border-border bg-cream/60 focus-visible:ring-brand"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> খোঁজা হচ্ছে...
                </>
              ) : (
                "অর্ডার দেখুন"
              )}
            </Button>
          </form>
        </div>

        {searched && (
          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
                এই নম্বরে কোনো অর্ডার পাওয়া যায়নি। নম্বরটি ঠিক আছে কিনা দেখুন।
              </div>
            ) : (
              orders.map((o) => {
                const meta = STATUS_BN[o.status] ?? STATUS_BN.pending;
                return (
                  <div key={o.orderCode} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-lg bg-cream px-2 py-0.5 font-mono text-xs font-bold text-ink">
                        {o.orderCode}
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {o.packageName} • {toBn(o.quantity)}টি •{" "}
                      <span className="font-bold text-brand">৳{toBn(o.totalPrice)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("bn-BD", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </main>
  );
}
