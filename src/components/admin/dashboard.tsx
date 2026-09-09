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
import { zoneCharge, isAllFree, type DeliveryConfig } from "@/lib/delivery-shared";
import {
  PACKAGE_META,
  perPiecePrice,
  type ProductConfig,
} from "@/lib/product-shared";
import {
  TEMPLATE_SLOT_LEGEND,
  type WhatsappConfig,
} from "@/lib/whatsapp-shared";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Activity,
  BadgeCheck,
  Clock,
  Download,
  MapPin,
  MessageCircle,
  Package,
  LogOut,
  Phone,
  Pin,
  RefreshCw,
  Tag,
  TrendingUp,
  Truck,
  Wallet,
  Save,
  Settings2,
} from "lucide-react";

type OrderLike = {
  id: string;
  orderCode: string;
  name: string;
  phone: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  color: string;
  colors: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  deliveryZone: string;
  deliveryCharge: number;
  totalPrice: number;
  status: string;
  pinned: boolean;
  waSent: boolean;
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

/** All chosen colors, joined (falls back to the legacy single color). */
function orderColors(o: OrderLike): string {
  try {
    const arr = JSON.parse(o.colors) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((c) => colorLabel(String(c))).join(", ");
    }
  } catch {
    // fall through to legacy color
  }
  return colorLabel(o.color);
}

export function AdminDashboard({
  initialOrders,
  deliveryConfig: initialConfig,
  productConfig: initialProducts,
  locationEnabled: initialLocationEnabled,
  whatsapp: initialWhatsapp,
}: {
  initialOrders: OrderLike[];
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
  locationEnabled: boolean;
  whatsapp: WhatsappConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderLike[]>(initialOrders);
  const [config, setConfig] = useState<DeliveryConfig>(initialConfig);
  const [chargeInputs, setChargeInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialConfig.zones.map((z) => [z.id, String(z.charge)]))
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [products, setProducts] = useState<ProductConfig>(initialProducts);
  const [priceInputs, setPriceInputs] = useState<Record<string, { price: string; oldPrice: string }>>(
    () =>
      Object.fromEntries(
        initialProducts.packages.map((p) => [
          p.id,
          { price: String(p.price), oldPrice: String(p.oldPrice) },
        ])
      )
  );
  const [savingProducts, setSavingProducts] = useState(false);
  const [locOn, setLocOn] = useState<boolean>(initialLocationEnabled);
  const [savingLoc, setSavingLoc] = useState(false);
  const [waInputs, setWaInputs] = useState<WhatsappConfig>(initialWhatsapp);
  const [savingWa, setSavingWa] = useState(false);
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
      deliverySum: active.reduce((s, o) => s + o.deliveryCharge, 0),
    };
  }, [orders]);

  // Pinned orders always stay on top (server also returns them first)
  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false)
      ),
    [orders]
  );

  const visibleOrders =
    filter === "all" ? sortedOrders : sortedOrders.filter((o) => o.status === filter);

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
      const data = await res.json().catch(() => null);
      if (data?.order) {
        const w = data.order.waSent;
        setOrders((cur) =>
          cur.map((o) => (o.id === id ? { ...o, waSent: w ?? o.waSent } : o))
        );
      }
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

  const togglePin = async (id: string, pinned: boolean) => {
    const prev = orders;
    setOrders((cur) => cur.map((o) => (o.id === id ? { ...o, pinned } : o)));
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pinned }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: pinned ? "📌 অর্ডার সবার উপরে পিন করা হয়েছে" : "পিন সরানো হয়েছে",
      });
    } catch {
      setOrders(prev);
      toast({
        title: "আপডেট ব্যর্থ",
        description: "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
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

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charges: chargeInputs }),
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
      setConfig(data.config);
      setChargeInputs(
        Object.fromEntries(data.config.zones.map((z) => [z.id, String(z.charge)]))
      );
      toast({
        title: "ডেলিভারি চার্জ সেভ হয়েছে",
        description: isAllFree(data.config)
          ? "সব এলাকায় এখন ফ্রি ডেলিভারি চালু আছে।"
          : "ওয়েবসাইটের অর্ডার ফর্মে নতুন চার্জ দেখা যাবে।",
      });
    } catch {
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };
  const saveProducts = async () => {
    setSavingProducts(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: products.packages.map((p) => ({
            id: p.id,
            price: Number(priceInputs[p.id]?.price),
            oldPrice: Number(priceInputs[p.id]?.oldPrice),
          })),
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
      setProducts(data.products);
      setPriceInputs(
        Object.fromEntries(
          data.products.packages.map((p: { id: string; price: number; oldPrice: number }) => [
            p.id,
            { price: String(p.price), oldPrice: String(p.oldPrice) },
          ])
        )
      );
      toast({
        title: "প্যাকেজ প্রাইস সেভ হয়েছে",
        description: "ওয়েবসাইটের সব জায়গায় নতুন দাম দেখা যাবে।",
      });
    } catch {
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSavingProducts(false);
    }
  };

  const toggleLocation = async (v: boolean) => {
    const prev = locOn;
    setLocOn(v);
    setSavingLoc(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationEnabled: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast({
        title: v ? "এলাকা সিলেকশন চালু হয়েছে" : "এলাকা সিলেকশন বন্ধ হয়েছে",
        description: v
          ? "অর্ডার ফর্মে বিভাগ/জেলা/উপজেলা দেখাবে।"
          : "অর্ডার ফর্মে এলাকা ব্লক দেখাবে না।",
      });
    } catch {
      setLocOn(prev);
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSavingLoc(false);
    }
  };

  const saveWhatsapp = async () => {
    setSavingWa(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: waInputs }),
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
      setWaInputs(data.whatsapp);
      toast({
        title: "WhatsApp সেটিংস সেভ হয়েছে",
        description: data.whatsapp.enabled
          ? "এখন থেকে confirm করলে কাস্টমারের WhatsApp-এ মেসেজ যাবে।"
          : "অটো-মেসেজ বন্ধ আছে।",
      });
    } catch {
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    } finally {
      setSavingWa(false);
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href="/api/admin/orders/export" download>
              <Button variant="outline" size="sm" className="rounded-full">
                <Download className="mr-1.5 size-4" /> CSV
              </Button>
            </a>
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
        <Tabs defaultValue="orders">
          <TabsList className="mt-6 grid w-full max-w-md grid-cols-2 rounded-full bg-white p-1 shadow-sm">
            <TabsTrigger
              value="orders"
              className="rounded-full font-bold data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              📦 অর্ডার ({toBn(orders.length)})
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-full font-bold data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              ⚙️ সেটিংস
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders">
        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          <StatCard
            icon={<Truck className="size-5 text-honey" />}
            label="ডেলিভারি চার্জ মোট"
            value={`৳${toBn(stats.deliverySum)}`}
            bg="bg-honey/10"
          />
        </div>

        </TabsContent>
        <TabsContent value="settings">
        {/* Delivery charge settings */}
        <div className="mt-6 rounded-2xl border border-honey/40 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Settings2 className="size-5 text-brand" />
              <div>
                <h2 className="font-bold text-ink">ডেলিভারি চার্জ সেটিংস</h2>
                <p className="text-xs text-muted-foreground">
                  এখানে চার্জ বদলালে ওয়েবসাইটের অর্ডার ফর্মে সাথে সাথে পরিবর্তন হয়ে যাবে। ০ দিলে সেই এলাকায় ফ্রি ডেলিভারি।
                </p>
              </div>
            </div>
            <Button
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {savingSettings ? (
                <>
                  <RefreshCw className="mr-1.5 size-4 animate-spin" /> সেভ হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 size-4" /> সেভ করুন
                </>
              )}
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.zones.map((z) => (
              <div key={z.id} className="rounded-xl border border-border bg-cream/50 p-3.5">
                <label className="text-sm font-semibold text-ink">{z.label}</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">৳</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    value={chargeInputs[z.id] ?? "0"}
                    onChange={(e) =>
                      setChargeInputs((cur) => ({ ...cur, [z.id]: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-base font-bold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Number(chargeInputs[z.id]) > 0
                    ? `অর্ডারে যোগ হবে: ৳${toBn(Number(chargeInputs[z.id]) || 0)}`
                    : "এই এলাকায় ফ্রি ডেলিভারি"}
                </p>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-border bg-cream/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <b className="text-ink">বর্তমানে চালু:</b>{" "}
              {isAllFree(config)
                ? "সব এলাকায় ফ্রি ডেলিভারি — অর্ডার ফর্মে এলাকা সিলেক্টর দেখাবে না।"
                : config.zones.map((z) => `${z.label} ৳${toBn(zoneCharge(config, z.id))}`).join(", ") +
                  " — অর্ডার ফর্মে এলাকা সিলেক্টর দেখাবে।"}
            </div>
          </div>
        </div>

        {/* Product prices */}
        <div className="mt-6 rounded-2xl border border-brand/40 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag className="size-5 text-brand" />
              <div>
                <h2 className="font-bold text-ink">প্যাকেজ প্রাইস সেটিংস</h2>
                <p className="text-xs text-muted-foreground">
                  দাম বদলে সেভ করলে প্রাইসিং সেকশন, অর্ডার ফর্ম ও অর্ডারের হিসাবে সাথে সাথে নতুন দাম বসবে।
                </p>
              </div>
            </div>
            <Button
              onClick={saveProducts}
              disabled={savingProducts}
              className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {savingProducts ? (
                <>
                  <RefreshCw className="mr-1.5 size-4 animate-spin" /> সেভ হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 size-4" /> সেভ করুন
                </>
              )}
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.packages.map((p) => {
              const meta = PACKAGE_META[p.id];
              const inPrice = Number(priceInputs[p.id]?.price);
              const inOld = Number(priceInputs[p.id]?.oldPrice);
              return (
                <div key={p.id} className="rounded-xl border border-border bg-cream/50 p-3.5">
                  <label className="text-sm font-semibold text-ink">
                    {meta.priceName}{" "}
                    <span className="font-normal text-muted-foreground">({meta.qtyLabel})</span>
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">বিক্রয় মূল্য (৳)</span>
                      <input
                        type="number"
                        min={0}
                        max={999999}
                        inputMode="numeric"
                        value={priceInputs[p.id]?.price ?? "0"}
                        onChange={(e) =>
                          setPriceInputs((cur) => ({
                            ...cur,
                            [p.id]: { ...cur[p.id], price: e.target.value },
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-base font-bold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">আগের মূল্য (৳)</span>
                      <input
                        type="number"
                        min={0}
                        max={999999}
                        inputMode="numeric"
                        value={priceInputs[p.id]?.oldPrice ?? "0"}
                        onChange={(e) =>
                          setPriceInputs((cur) => ({
                            ...cur,
                            [p.id]: { ...cur[p.id], oldPrice: e.target.value },
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-base font-bold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    প্রতি পিস: ৳
                    {toBn(perPiecePrice({ price: inPrice || 0, quantity: meta.quantity }))}
                    {inOld > inPrice ? ` • সাশ্রয়: ৳${toBn(inOld - inPrice)}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location block toggle */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-brand" />
            <div>
              <h2 className="font-bold text-ink">অর্ডার ফর্মে এলাকা সিলেকশন</h2>
              <p className="text-xs text-muted-foreground">
                চালু থাকলে কাস্টমারকে বিভাগ → জেলা → উপজেলা বেছে দিতে হবে। বন্ধ করলে ফর্মে এই ব্লক দেখাবে না।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {locOn ? "চালু" : "বন্ধ"}
            </span>
            <Switch checked={locOn} disabled={savingLoc} onCheckedChange={toggleLocation} />
          </div>
        </div>

        {/* WhatsApp auto-message settings */}
        <div className="mt-6 rounded-2xl border border-[#128C4B]/40 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-[#128C4B]" />
              <div>
                <h2 className="font-bold text-ink">WhatsApp অটো-মেসেজ (confirm-এ)</h2>
                <p className="text-xs text-muted-foreground">
                  চালু থাকলে কোনো অর্ডার confirm করলে কাস্টমারের WhatsApp-এ মেসেজ যাবে (Meta template)।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveWhatsapp}
                disabled={savingWa}
                className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
              >
                {savingWa ? (
                  <>
                    <RefreshCw className="mr-1.5 size-4 animate-spin" /> সেভ হচ্ছে...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 size-4" /> সেভ করুন
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
              <div>
                <div className="text-sm font-semibold text-ink">অটো-মেসেজ {waInputs.enabled ? "চালু" : "বন্ধ"}</div>
                <p className="text-xs text-muted-foreground">Token/ID ছাড়া চালু করলে মেসেজ যাবে না।</p>
              </div>
              <Switch
                checked={waInputs.enabled}
                onCheckedChange={(v) => setWaInputs((cur) => ({ ...cur, enabled: v }))}
              />
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Phone Number ID *</label>
              <input
                value={waInputs.phoneNumberId}
                onChange={(e) => setWaInputs((cur) => ({ ...cur, phoneNumberId: e.target.value }))}
                placeholder="যেমন: 123456789012345"
                inputMode="numeric"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Meta developer dashboard → WhatsApp → API Setup</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Access Token *</label>
              <input
                type="password"
                value={waInputs.accessToken}
                onChange={(e) => setWaInputs((cur) => ({ ...cur, accessToken: e.target.value }))}
                placeholder="EAAxxxx…"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Temporary (২৪ ঘণ্টা) বা permanent system-user token</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Template Name *</label>
              <input
                value={waInputs.templateName}
                onChange={(e) => setWaInputs((cur) => ({ ...cur, templateName: e.target.value }))}
                placeholder="যেমন: order_confirm_bn"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Meta-তে approve হওয়া template-এর ঠিক নাম</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Template Language</label>
              <input
                value={waInputs.languageCode}
                onChange={(e) => setWaInputs((cur) => ({ ...cur, languageCode: e.target.value }))}
                placeholder="bn"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Template যে ভাষায় approve হয়েছে (যেমন: bn)</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
              <label className="text-sm font-semibold text-ink">মেসেজ টেমপ্লেট (রেফারেন্স)</label>
              <textarea
                value={waInputs.templateBody}
                onChange={(e) => setWaInputs((cur) => ({ ...cur, templateBody: e.target.value }))}
                rows={4}
                placeholder="Meta-তে approve হওয়া template-এর body হুবহু এখানে রাখুন"
                className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-2 rounded-lg bg-cream p-3 text-xs leading-relaxed text-muted-foreground">
                <b className="text-ink">স্লটের অর্থ (পাঠানোর সময় এই ক্রমে বসবে):</b>
                <ul className="mt-1 space-y-0.5">
                  {TEMPLATE_SLOT_LEGEND.map((s) => (
                    <li key={s.slot}>
                      <span className="font-mono font-bold text-ink">{s.slot}</span> — {s.meaning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Pixel setup link */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-brand" />
            <div>
              <h2 className="font-bold text-ink">Meta Pixel সেটআপ</h2>
              <p className="text-xs text-muted-foreground">
                Pixel ID ও ইভেন্ট চালু/বন্ধ করুন — অর্ডার ট্র্যাকিং এর জন্য।
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/pixel")}
            className="rounded-full font-bold"
          >
            <Activity className="mr-1.5 size-4" /> খুলুন
          </Button>
        </div>
        </TabsContent>
        <TabsContent value="orders">
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
                        {o.waSent && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            📲 WhatsApp ✓
                          </span>
                        )}
                        <button
                          onClick={() => togglePin(o.id, !o.pinned)}
                          title={o.pinned ? "পিন সরান" : "সবার উপরে পিন করুন"}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors ${
                            o.pinned
                              ? "border-brand bg-brand text-white"
                              : "border-border bg-white text-muted-foreground hover:border-brand/50 hover:text-brand"
                          }`}
                        >
                          <Pin className={`size-3 ${o.pinned ? "fill-white" : ""}`} />
                          {o.pinned ? "পিনড" : "পিন"}
                        </button>
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
                      {[o.division, o.district, o.upazila].some(Boolean) && (
                        <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-ink">
                          📍 {[o.division, o.district, o.upazila].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {orderColors(o)} • {o.packageName} • {toBn(o.quantity)}টি
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {o.deliveryZone
                            ? `${config.zones.find((z) => z.id === o.deliveryZone)?.label ?? o.deliveryZone}: `
                            : ""}
                          পণ্য ৳{toBn(o.totalPrice - o.deliveryCharge)}
                          {o.deliveryCharge > 0 ? ` + ডেলিভারি ৳${toBn(o.deliveryCharge)}` : " + ডেলিভারি ফ্রি"}
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
        </TabsContent>
        </Tabs>
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
