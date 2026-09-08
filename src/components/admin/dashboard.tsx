"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_COLORS, toBn } from "@/lib/landing-data";
import {
  BadgeCheck,
  Clock,
  Package,
  LogOut,
  Phone,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

type OrderLike = {
  id: string;
  orderCode: string;
  name: string;
  phone: string;
  address: string;
  color: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  createdAt: string | Date;
};

const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "পেন্ডিং",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "কনফার্মড",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  shipped: {
    label: "শিপমেন্টে",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
  },
  delivered: {
    label: "ডেলিভার্ড",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "বাতিল",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
};

const STATUS_ORDER = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

function formatDate(value: string | Date): string {
  const d = new Date(value);
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const period =
    hh < 6 ? "ভোর" : hh < 12 ? "সকাল" : hh < 16 ? "দুপুর" : hh < 18 ? "বিকাল" : hh < 20 ? "সন্ধ্যা" : "রাত";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${toBn(d.getDate())} ${BN_MONTHS[d.getMonth()]} ${toBn(d.getFullYear())}, ${period} ${toBn(h12)}:${toBn(Number(mm))}`;
}

function colorLabel(id: string): string {
  return PRODUCT_COLORS.find((c) => c.id === id)?.label ?? id;
}

export function AdminDashboard({ initialOrders }: { initialOrders: OrderLike[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderLike[]>(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status !== "cancelled");
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      revenue: active.reduce((s, o) => s + o.totalPrice, 0),
      deliveredRevenue: orders
        .filter((o) => o.status === "delivered")
        .reduce((s, o) => s + o.totalPrice, 0),
    };
  }, [orders]);

  const visibleOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const updateStatus = async (id: string, status: string) => {
    const prev = orders;
    setUpdatingId(id);
    setOrders((cur) => cur.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "স্ট্যাটাস আপডেট হয়েছে", description: STATUS_META[status]?.label });
    } catch {
      setOrders(prev);
      toast({
        title: "আপডেট ব্যর্থ",
        description: "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      setOrders(data.orders);
      toast({ title: "তালিকা রিফ্রেশ হয়েছে" });
    } catch {
      toast({ title: "রিফ্রেশ ব্যর্থ", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-cream/60 pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-ink">
              🧸 ঘুমপাড়া বেবি <span className="text-brand">— অ্যাডমিন প্যানেল</span>
            </h1>
            <p className="text-xs text-muted-foreground">অর্ডার ম্যানেজমেন্ট ড্যাশবোর্ড</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-full"
            >
              <RefreshCw className={`mr-1.5 size-4 ${refreshing ? "animate-spin" : ""}`} />
              রিফ্রেশ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="mr-1.5 size-4" /> লগআউট
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<Package className="size-5 text-brand" />}
            label="মোট অর্ডার"
            value={toBn(stats.total)}
            bg="bg-brand-soft/70"
          />
          <StatCard
            icon={<Clock className="size-5 text-amber-600" />}
            label="পেন্ডিং"
            value={toBn(stats.pending)}
            bg="bg-amber-50"
          />
          <StatCard
            icon={<BadgeCheck className="size-5 text-emerald-600" />}
            label="ডেলিভার্ড"
            value={toBn(stats.delivered)}
            bg="bg-emerald-50"
          />
          <StatCard
            icon={<TrendingUp className="size-5 text-blue-600" />}
            label="মোট অর্ডার ভ্যালু"
            value={`৳${toBn(stats.revenue)}`}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<Wallet className="size-5 text-leaf" />}
            label="ডেলিভার্ড ভ্যালু"
            value={`৳${toBn(stats.deliveredRevenue)}`}
            bg="bg-leaf/10"
          />
        </div>

        {/* Filter */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: `সব (${toBn(orders.length)})` },
            ...STATUS_ORDER.map((s) => ({
              id: s,
              label: `${STATUS_META[s].label} (${toBn(orders.filter((o) => o.status === s).length)})`,
            })),
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                filter === f.id
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-white text-muted-foreground hover:border-brand/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        <div className="mt-4 space-y-3">
          {visibleOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-muted-foreground">
              এই ক্যাটাগরিতে কোনো অর্ডার নেই।
            </div>
          ) : (
            visibleOrders.map((o) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.pending;
              return (
                <div
                  key={o.id}
                  className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-cream px-2 py-0.5 font-mono text-xs font-bold text-ink">
                          {o.orderCode}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2 font-bold text-ink">{o.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <a
                          href={`tel:+88${o.phone}`}
                          className="flex items-center gap-1 font-semibold text-brand hover:underline"
                        >
                          <Phone className="size-3.5" /> {o.phone}
                        </a>
                        <a
                          href={`https://wa.me/88${o.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-semibold text-[#128C4B] hover:underline"
                        >
                          <svg viewBox="0 0 32 32" fill="currentColor" className="size-3.5" aria-hidden="true">
                            <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.803 12.8 0 2.257.59 4.46 1.712 6.403L3.2 28.8l6.56-1.72a12.75 12.75 0 0 0 6.24 1.6h.005c7.058 0 12.8-5.74 12.802-12.8 0-3.42-1.331-6.637-3.75-9.055A12.71 12.71 0 0 0 16.004 3.2Zm0 23.382h-.004a10.63 10.63 0 0 1-5.416-1.483l-.389-.23-4.028 1.056 1.076-3.927-.253-.403a10.6 10.6 0 0 1-1.627-5.656c.002-5.868 4.776-10.64 10.645-10.64 2.842 0 5.512 1.108 7.52 3.117a10.57 10.57 0 0 1 3.114 7.527c-.003 5.869-4.776 10.639-10.638 10.639Zm5.835-7.962c-.32-.16-1.89-.932-2.182-1.039-.292-.107-.504-.16-.716.16-.212.32-.823 1.038-1.01 1.25-.185.212-.37.24-.69.08-.32-.16-1.35-.497-2.571-1.585-.95-.847-1.592-1.893-1.778-2.213-.185-.32-.02-.493.14-.652.144-.143.32-.372.48-.558.16-.186.212-.32.32-.532.106-.213.053-.399-.027-.559-.08-.16-.716-1.724-.98-2.361-.258-.62-.52-.536-.716-.546l-.61-.01c-.212 0-.558.08-.85.399-.292.32-1.113 1.088-1.113 2.653s1.14 3.077 1.298 3.29c.16.212 2.242 3.423 5.431 4.798.759.328 1.351.523 1.813.67.762.242 1.455.208 2.003.126.611-.091 1.89-.772 2.156-1.518.266-.746.266-1.385.186-1.519-.08-.133-.292-.212-.612-.372Z" />
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {o.address}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {colorLabel(o.color)} • {o.packageName} • {toBn(o.quantity)}টি
                        </div>
                        <div className="text-xl font-bold text-brand">৳{toBn(o.totalPrice)}</div>
                      </div>
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o.id, v)}
                        disabled={updatingId === o.id}
                      >
                        <SelectTrigger className="w-40 rounded-full border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border border-border ${bg} p-4`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}
