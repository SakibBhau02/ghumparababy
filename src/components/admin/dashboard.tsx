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
  DEFAULT_TIERS,
  PACKAGE_META,
  priceForQty,
  type ProductConfig,
} from "@/lib/product-shared";
import {
  TEMPLATE_SLOT_LEGEND,
  type WhatsappConfig,
} from "@/lib/whatsapp-shared";
import { type TelegramConfig } from "@/lib/telegram-shared";
import { type SteadfastConfig } from "@/lib/steadfast-shared";
import { type ShopbaseConfig } from "@/lib/shopbase-shared";
import { type ManyDialConfig } from "@/lib/manydial-shared";
import { ShopbaseSetup } from "@/components/admin/shopbase-setup";
import { ManyDialSetup } from "@/components/admin/manydial-setup";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { OrderEditModal } from "@/components/admin/order-edit-modal";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Clock,
  Copy,
  Download,
  MapPin,
  MessageCircle,
  Package,
  PhoneOutgoing,
  ShoppingBag,
  LogOut,
  LifeBuoy,
  Pencil,
  Phone,
  Pin,
  Printer,
  RefreshCw,
  Trash2,
  Users,
  Tag,
  TrendingUp,
  Truck,
  Wallet,
  Save,
  Send,
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
  consignmentId: string;
  trackingCode: string;
  shopbaseOrderId: string;
  adminNote: string;
  createdAt: string | Date;
};

type CustomerLike = {
  phone: string;
  name: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string | Date;
  lastOrderAt: string | Date;
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

/** Small copy-to-clipboard chip used in the Telegram setup guide. */
function CopyChip({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="ml-1 inline-flex items-center gap-1 rounded-full border border-[#229ED9]/40 bg-[#229ED9]/10 px-2 py-0.5 align-middle font-mono text-[11px] font-bold text-[#0b6d9e] transition-colors hover:bg-[#229ED9]/20"
    >
      <Copy className="size-3" /> {copied ? "কপি ✓" : text}
    </button>
  );
}

/** External Telegram link chip (opens in a new tab). */
function TgLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#229ED9] px-2.5 py-0.5 align-middle text-[11px] font-bold text-white transition-colors hover:bg-[#1b8bc0]"
    >
      {children} ↗
    </a>
  );
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
  telegram: initialTelegram,
  steadfast: initialSteadfast,
  shopbase: initialShopbase,
  manydial: initialManyDial,
  customers: initialCustomers,
}: {
  initialOrders: OrderLike[];
  deliveryConfig: DeliveryConfig;
  productConfig: ProductConfig;
  locationEnabled: boolean;
  whatsapp: WhatsappConfig;
  telegram: TelegramConfig;
  steadfast: SteadfastConfig;
  shopbase: ShopbaseConfig;
  manydial: ManyDialConfig;
  customers: CustomerLike[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderLike[]>(initialOrders);
  const [customers] = useState<CustomerLike[]>(initialCustomers);
  const [config, setConfig] = useState<DeliveryConfig>(initialConfig);
  const [chargeInputs, setChargeInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialConfig.zones.map((z) => [z.id, String(z.charge)]))
  );
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialConfig.zones.map((z) => [z.id, z.note ?? ""]))
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [products, setProducts] = useState<ProductConfig>(initialProducts);
  const [tierInputs, setTierInputs] = useState<string[]>(() =>
    initialProducts.tiers.length === 10
      ? initialProducts.tiers.map(String)
      : [...DEFAULT_TIERS].map(String)
  );
  const [oldInputs, setOldInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialProducts.packages.map((p) => [p.id, String(p.oldPrice)]))
  );
  const [savingProducts, setSavingProducts] = useState(false);
  const [locOn, setLocOn] = useState<boolean>(initialLocationEnabled);
  const [savingLoc, setSavingLoc] = useState(false);
  const [waInputs, setWaInputs] = useState<WhatsappConfig>(initialWhatsapp);
  const [savingWa, setSavingWa] = useState(false);
  const [tgInputs, setTgInputs] = useState<TelegramConfig>(initialTelegram);
  const [connectingTg, setConnectingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [showTgGuide, setShowTgGuide] = useState(true);
  const [showTgHelp, setShowTgHelp] = useState(false);
  const [sfInputs, setSfInputs] = useState<SteadfastConfig>(initialSteadfast);
  const [checkingSf, setCheckingSf] = useState(false);
  const [sendingSfId, setSendingSfId] = useState<string | null>(null);
  const [showSfGuide, setShowSfGuide] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCmd = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      toast({
        title: "কপি হয়নি",
        description: "লেখাটা সিলেক্ট করে নিজে কপি করুন।",
        variant: "destructive",
      });
    }
  };
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [editingOrder, setEditingOrder] = useState<OrderLike | null>(null);
  const [shopbaseOrder, setShopbaseOrder] = useState<OrderLike | null>(null);
  const [deleteArm, setDeleteArm] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [custQuery, setCustQuery] = useState("");
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);

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

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim();
    if (!q) return customers;
    return customers.filter((c) => c.name.includes(q) || c.phone.includes(q));
  }, [customers, custQuery]);

  const toggleSelectOne = (id: string) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const printSelected = (per: 2 | 4 | 6) => {
    if (selectedIds.length === 0) return;
    window.open(`/admin/print?ids=${selectedIds.join(",")}&per=${per}`, "_blank");
  };

  const handleDelete = async (id: string) => {
    if (deleteArm !== id) {
      setDeleteArm(id);
      setTimeout(() => {
        setDeleteArm((cur) => (cur === id ? null : cur));
      }, 5000);
      return;
    }
    setDeleteArm(null);
    const prev = orders;
    setOrders((cur) => cur.filter((o) => o.id !== id));
    setSelectedIds((cur) => cur.filter((x) => x !== id));
    try {
      const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "অর্ডার ডিলিট হয়েছে" });
    } catch {
      setOrders(prev);
      toast({ title: "ডিলিট ব্যর্থ", variant: "destructive" });
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
        body: JSON.stringify({ charges: chargeInputs, notes: noteInputs }),
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
      setNoteInputs(
        Object.fromEntries(
          data.config.zones.map((z: { id: string; note: string }) => [z.id, z.note ?? ""])
        )
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
          products: {
            tiers: tierInputs.map((t) => Number(t)),
            packages: products.packages.map((p) => ({
              id: p.id,
              oldPrice: Number(oldInputs[p.id]),
            })),
          },
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
      setTierInputs(data.products.tiers.map((t: number) => String(t)));
      setOldInputs(
        Object.fromEntries(
          data.products.packages.map((p: { id: string; oldPrice: number }) => [
            p.id,
            String(p.oldPrice),
          ])
        )
      );
      toast({
        title: "দামের table সেভ হয়েছে",
        description: "ওয়েবসাইট ও অর্ডারের হিসাবে সাথে সাথে নতুন দাম বসবে।",
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

  const connectTelegram = async () => {
    setConnectingTg(true);
    try {
      const res = await fetch("/api/admin/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: tgInputs.botToken, chatId: tgInputs.chatId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "কানেক্ট হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setTgInputs(data.telegram);
      toast({
        title: "Telegram Connected ✓",
        description: data.bot?.username
          ? `@${data.bot.username} — এখন থেকে নতুন অর্ডার এখানে আসবে।`
          : "এখন থেকে নতুন অর্ডার Telegram-এ আসবে।",
      });
    } catch {
      toast({ title: "কানেক্ট ব্যর্থ", variant: "destructive" });
    } finally {
      setConnectingTg(false);
    }
  };

  const sendTelegramTest = async () => {
    setTestingTg(true);
    try {
      const res = await fetch("/api/admin/telegram/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "টেস্ট যায়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "টেস্ট পাঠানো হয়েছে", description: "Telegram চ্যাটে ছবিসহ নমুনা অর্ডার দেখুন।" });
    } catch {
      toast({ title: "টেস্ট ব্যর্থ", variant: "destructive" });
    } finally {
      setTestingTg(false);
    }
  };

  const toggleTelegram = async (v: boolean) => {
    const next = { ...tgInputs, enabled: v };
    setTgInputs(next);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTgInputs(tgInputs);
        toast({
          title: "সেভ হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setTgInputs(data.telegram);
    } catch {
      setTgInputs(tgInputs);
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    }
  };

  const checkSteadfast = async () => {
    setCheckingSf(true);
    try {
      const res = await fetch("/api/admin/courier/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: sfInputs.apiKey, secretKey: sfInputs.secretKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "যাচাই হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setSfInputs({ enabled: true, apiKey: sfInputs.apiKey, secretKey: sfInputs.secretKey });
      toast({
        title: "Steadfast Connected ✓",
        description: `ব্যালেন্স ৳${data.balance} — এখন one-click-এ consignment বানাতে পারবেন।`,
      });
    } catch {
      toast({ title: "যাচাই ব্যর্থ", variant: "destructive" });
    } finally {
      setCheckingSf(false);
    }
  };

  const toggleSteadfast = async (v: boolean) => {
    const next = { ...sfInputs, enabled: v };
    setSfInputs(next);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steadfast: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSfInputs(sfInputs);
        toast({
          title: "সেভ হয়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setSfInputs(data.steadfast);
    } catch {
      setSfInputs(sfInputs);
      toast({ title: "সেভ ব্যর্থ", variant: "destructive" });
    }
  };

  const sendToCourier = async (id: string) => {
    setSendingSfId(id);
    try {
      const res = await fetch("/api/admin/courier/consignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "কুরিয়ারে যায়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      setOrders((cur) =>
        cur.map((x) =>
          x.id === id
            ? { ...x, consignmentId: data.consignmentId ?? "", trackingCode: data.trackingCode ?? "" }
            : x
        )
      );
      toast({
        title: data.duplicate ? "এটা আগেই পাঠানো ছিল" : "Steadfast consignment তৈরি ✓",
        description: `Consignment ID: ${data.consignmentId}${data.trackingCode ? ` • Tracking: ${data.trackingCode}` : ""}`,
      });
    } catch {
      toast({ title: "পাঠানো ব্যর্থ", variant: "destructive" });
    } finally {
      setSendingSfId(null);
    }
  };

  const [callingMdId, setCallingMdId] = useState<string | null>(null);

  const recallManyDial = async (id: string) => {
    setCallingMdId(id);
    try {
      const res = await fetch("/api/admin/manydial/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "কল যায়নি",
          description: data.error ?? "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "কনফার্মেশন কল চলে গেছে ✓",
        description: "কাস্টমার কল ধরে ১/২ চাপলে Telegram-এ খবর আসবে।",
      });
    } catch {
      toast({ title: "কল ব্যর্থ", variant: "destructive" });
    } finally {
      setCallingMdId(null);
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
          <TabsList className="mt-6 grid w-full max-w-lg grid-cols-3 rounded-full bg-white p-1 shadow-sm">
            <TabsTrigger
              value="orders"
              className="rounded-full font-bold data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              📦 অর্ডার ({toBn(orders.length)})
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="rounded-full font-bold data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              👥 কাস্টমার ({toBn(customers.length)})
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
                <h2 className="font-bold text-ink">ডেলিভারি চার্জ + নোট সেটিংস</h2>
                <p className="text-xs text-muted-foreground">
                  চার্জ/নোট বদলালে ওয়েবসাইটে সাথে সাথে বসবে। ০ দিলে সেই এলাকায় ফ্রি। ৩+ পিসের অর্ডারে সব এলাকায় ডেলিভারি অটো-ফ্রি।
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
                <label className="mt-2 block text-xs font-semibold text-ink">
                  কাস্টম নোট <span className="font-normal text-muted-foreground">(ওয়েবসাইট + invoice-তে দেখাবে)</span>
                </label>
                <input
                  value={noteInputs[z.id] ?? ""}
                  onChange={(e) =>
                    setNoteInputs((cur) => ({ ...cur, [z.id]: e.target.value }))
                  }
                  placeholder="যেমন: ঈদের ছুটিতে ২ দিন দেরি হতে পারে"
                  maxLength={140}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
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
                <h2 className="font-bold text-ink">দামের table (ভলিউম ডিসকাউন্ট)</h2>
                <p className="text-xs text-muted-foreground">
                  মোট যত পিস, প্রতি-পিস তত সস্তা। সেভ করলে ওয়েবসাইট ও অর্ডারের হিসাবে সাথে সাথে বসবে। পরের ঘরের দাম আগেরটার চেয়ে বেশি হতে পারবে না।
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {tierInputs.map((t, i) => {
              const n = i + 1;
              const perPiece = Number(t) || 0;
              return (
                <div key={n} className="rounded-xl border border-border bg-cream/50 p-3">
                  <label className="text-sm font-semibold text-ink">
                    {toBn(n)}টি নিলে <span className="font-normal text-muted-foreground">/পিস</span>
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-sm font-bold text-muted-foreground">৳</span>
                    <input
                      type="number"
                      min={0}
                      max={99999}
                      inputMode="numeric"
                      value={t}
                      onChange={(e) =>
                        setTierInputs((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      className="h-10 w-full rounded-lg border border-border bg-white px-3 text-base font-bold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    মোট ৳{toBn(perPiece * n)}
                    {n >= 3 ? " • 🚚 ফ্রি" : ""}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {products.packages.map((p) => {
              const meta = PACKAGE_META[p.id];
              return (
                <div key={p.id} className="rounded-xl border border-dashed border-border bg-cream/30 p-3">
                  <label className="text-xs font-semibold text-ink">
                    {meta.priceName} — আগের মূল্য (৳, কাটা দাম)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999999}
                    inputMode="numeric"
                    value={oldInputs[p.id] ?? "0"}
                    onChange={(e) =>
                      setOldInputs((cur) => ({ ...cur, [p.id]: e.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-base font-bold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
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

        {/* Telegram order alerts */}
        <div className="mt-6 rounded-2xl border border-[#229ED9]/40 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Send className="size-5 text-[#229ED9]" />
              <div>
                <h2 className="font-bold text-ink">
                  Telegram অর্ডার অ্যালার্ট{" "}
                  {tgInputs.enabled && tgInputs.botUsername && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      Connected ✓ @{tgInputs.botUsername}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">
                  নতুন অর্ডার এলেই ফুল ডিটেইলস + প্রোডাক্ট ছবি আপনার Telegram চ্যাটে যাবে।
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={sendTelegramTest}
                disabled={testingTg || connectingTg}
                className="rounded-full font-bold"
              >
                {testingTg ? (
                  <>
                    <RefreshCw className="mr-1.5 size-4 animate-spin" /> পাঠাচ্ছে...
                  </>
                ) : (
                  "Test মেসেজ"
                )}
              </Button>
              <Button
                onClick={connectTelegram}
                disabled={connectingTg || testingTg}
                className="rounded-full bg-[#229ED9] font-bold text-white hover:bg-[#1b8bc0] disabled:opacity-60"
              >
                {connectingTg ? (
                  <>
                    <RefreshCw className="mr-1.5 size-4 animate-spin" /> কানেক্ট হচ্ছে...
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 size-4" /> Connect চাপুন
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Live setup checklist — ticks itself as you complete each step */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { done: tgInputs.botToken.length > 0, label: "১. Token বসানো" },
              { done: tgInputs.chatId.length > 0, label: "২. Chat ID বসানো" },
              { done: tgInputs.botUsername.length > 0, label: "৩. Connected" },
              { done: tgInputs.enabled, label: "৪. অ্যালার্ট চালু" },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
                  s.done
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-cream/50 text-muted-foreground"
                }`}
              >
                {s.done ? "✓ " : "○ "}{s.label}
              </div>
            ))}
          </div>

          {/* Step-by-step Bengali setup guide */}
          <div className="mt-3 overflow-hidden rounded-xl border border-[#229ED9]/30">
            <button
              type="button"
              onClick={() => setShowTgGuide((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-[#229ED9]/10 px-4 py-3 text-left text-sm font-bold text-ink hover:bg-[#229ED9]/15"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="size-4 text-[#229ED9]" />
                📖 সেটআপ গাইড — ধাপে ধাপে (প্রথমবার পড়ুন)
              </span>
              <span className="text-[#229ED9]">{showTgGuide ? "▲" : "▼"}</span>
            </button>
            {showTgGuide && (
              <ol className="space-y-4 bg-white p-4 text-sm leading-relaxed text-ink">
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#229ED9] text-xs font-bold text-white">১</span>
                  <div>
                    <b>Bot বানান (২ মিনিট, একবারই):</b>
                    <br />ক) Telegram-এ
                    <TgLink href="https://t.me/BotFather">@BotFather খুলুন</TgLink>
                    খ) তাকে পাঠান:
                    <CopyChip text="/newbot" copied={copiedCmd === "newbot"} onCopy={() => copyCmd("newbot", "/newbot")} />
                    গ) bot-এর নাম দিন (যেমন: Ghumpara Baby Orders) ঘ) username দিন — শেষে <b>bot</b> থাকতেই হবে (যেমন: ghumpara_orders_bot) ঙ) BotFather যে লম্বা token দেবে (মাঝখানে <b>:</b> থাকে) → নিচে <b>Bot Token</b> ঘরে paste করুন।
                    <br />⚠️ Token গোপন রাখুন — এটা আপনার bot-এর চাবি।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#229ED9] text-xs font-bold text-white">২</span>
                  <div>
                    <b>Chat ID নিন (মেসেজ কোথায় যাবে):</b>
                    <br />• <b>নিজের ফোনে</b> পেতে চাইলে:
                    <TgLink href="https://t.me/userinfobot">@userinfobot খুলুন</TgLink>
                    → <b>/start</b> দিন → যে নম্বর দেবে সেটাই Chat ID। আর আপনার bot-টাকে খুঁজে একবার <b>/start</b> চেপে রাখুন (নইলে bot আপনাকে মেসেজ পাঠাতে পারবে না)।
                    <br />• <b>গ্রুপে</b> পেতে চাইলে (টিমের সবাই দেখবে): গ্রুপ খুলে আপনার bot-কে member হিসেবে add করুন → তারপর
                    <TgLink href="https://t.me/getmyid_bot">@getmyid_bot add করুন</TgLink>
                    → সে যে ID দেবে (মাইনাসসহ, যেমন -100…) → <b>পুরোটা</b> নিচে <b>Chat ID</b> ঘরে paste করুন → @getmyid_bot-কে গ্রুপ থেকে বের করে দিন।
                    <br />• <b>Channel-এ</b> চাইলে (যেমন @babyblanketlanding): bot-কে channel-এর <b>admin</b> বানান (বিস্তারিত নিচে <b>সমস্যা হচ্ছে?</b> অংশে) → Chat ID ঘরে channel-এর <b>@username</b> বসান।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#229ED9] text-xs font-bold text-white">৩</span>
                  <div>
                    <b>Connect চাপুন:</b> উপরের নীল <b>Connect চাপুন</b> বাটনে ক্লিক করুন। সবুজ <b>Connected ✓ @username</b> এলে সেভ সম্পূর্ণ — আর কিছু করা লাগবে না। লাল লেখা এলে নিচের <b>সমস্যা হচ্ছে?</b> অংশ দেখুন।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#229ED9] text-xs font-bold text-white">৪</span>
                  <div>
                    <b>Test করুন:</b> <b>Test মেসেজ</b> চাপুন → আপনার chat-এ ছবিসহ নমুনা অর্ডার এলে সেটআপ <b>১০০% OK</b>।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">৫</span>
                  <div>
                    <b>Live:</b> এখন থেকে প্রতিটা নতুন অর্ডার অটোমেটিক Telegram-এ আসবে। সাময়িক বন্ধ রাখতে চাইলে উপরের টগল বন্ধ করুন।
                  </div>
                </li>
              </ol>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
              <div>
                <div className="text-sm font-semibold text-ink">অ্যালার্ট {tgInputs.enabled ? "চালু" : "বন্ধ"}</div>
                <p className="text-xs text-muted-foreground">Connect করলেই অটো চালু হয়ে যাবে।</p>
              </div>
              <Switch checked={tgInputs.enabled} onCheckedChange={toggleTelegram} />
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Bot Token *</label>
              <input
                type="password"
                value={tgInputs.botToken}
                onChange={(e) => setTgInputs((cur) => ({ ...cur, botToken: e.target.value }))}
                placeholder="যেমন: 123456:ABC-DEF..."
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-[#229ED9] focus:ring-2 focus:ring-[#229ED9]/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Telegram-এ @BotFather → /newbot → token-টা copy-paste করুন</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Chat ID *</label>
              <input
                value={tgInputs.chatId}
                onChange={(e) => setTgInputs((cur) => ({ ...cur, chatId: e.target.value }))}
                placeholder="যেমন: 123456789 বা -1001234567890"
                inputMode="numeric"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-[#229ED9] focus:ring-2 focus:ring-[#229ED9]/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">নিজের ID: @userinfobot-কে মেসেজ দিন • গ্রুপের ID: bot-কে গ্রুপে add করে @getmyid_bot দিয়ে নিন</p>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="mt-3 overflow-hidden rounded-xl border border-amber-300/60">
            <button
              type="button"
              onClick={() => setShowTgHelp((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-amber-50 px-4 py-3 text-left text-sm font-bold text-ink hover:bg-amber-100/60"
            >
              <span className="flex items-center gap-2">
                <LifeBuoy className="size-4 text-amber-600" />
                ❓ সমস্যা হচ্ছে? — কারণ ও সমাধান
              </span>
              <span className="text-amber-600">{showTgHelp ? "▲" : "▼"}</span>
            </button>
            {showTgHelp && (
              <ul className="space-y-3 bg-white p-4 text-sm leading-relaxed text-ink">
                <li>
                  <b>“Bot Token সঠিক নয়” আসে →</b> @BotFather-কে
                  <CopyChip text="/token" copied={copiedCmd === "token"} onCopy={() => copyCmd("token", "/token")} />
                  পাঠিয়ে token-টা আবার মিলিয়ে নিন। paste করার সময় আগে-পিছে space থাকলে মুছে দিন।
                </li>
                <li>
                  <b>“Chat ID-তে মেসেজ পাঠানো যাচ্ছে না” আসে →</b> নিজের chat হলে: bot-টাকে খুঁজে <b>/start</b> চেপেছেন তো? গ্রুপ হলে: bot গ্রুপে add আছে তো? supergroup হলে bot-কে <b>admin</b> বানান। ID মাইনাসসহ (<b>-100…</b>) পুরোটা বসিয়েছেন তো?
                </li>
                <li>
                  <b>Channel-এ (যেমন @babyblanketlanding) দিতে চাইলে →</b> শুধু add করলে হবে না — bot-কে channel-এর <b>admin বানাতেই হবে</b> (Post Messages permission সহ)। ধাপ: Channel খুলুন → নামের উপর চাপ → Administrators → Add Admin → আপনার bot সিলেক্ট করুন → Post Messages ON রেখে Done → তারপর এখানে <b>Connect চাপুন</b>।
                </li>
                <li>
                  <b>“bot নিজেকে মেসেজ পাঠাতে পারে না” আসে →</b> Chat ID-এর জায়গায় ভুল করে bot-এর নিজের ID বসেছে (সাধারণত Token-এর সামনের সংখ্যাটা)। ওটা মুছে <TgLink href="https://t.me/userinfobot">@userinfobot</TgLink> থেকে আপনার নিজের ID বসিয়ে আবার Connect করুন।
                </li>
                <li>
                  <b>Test চাপলে “আগে Connect করুন” আসে →</b> ধাপ ৩ (Connect) শেষ না করে Test কাজ করবে না — আগে Connect সফল করুন।
                </li>
                <li>
                  <b>Test আসে, কিন্তু নতুন অর্ডারে আসে না →</b> উপরের <b>অ্যালার্ট চালু</b> টগল ON আছে কিনা দেখুন। ঠিক না হলে আবার Connect করুন।
                </li>
                <li>
                  <b>ছবি ছাড়া শুধু লেখা এলো →</b> অর্ডারের কালার-ছবি সার্ভারে না থাকলে এমন হয় — এটা হলে আমাকে জানান।
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Steadfast courier setup + one-click consignment */}
        <div className="mt-6 rounded-2xl border border-red-300/60 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-red-600" />
              <div>
                <h2 className="font-bold text-ink">
                  Steadfast কুরিয়ার{" "}
                  {sfInputs.enabled && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      Connected ✓
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">
                  One-click-এ অর্ডার Steadfast-এ যাবে, consignment ID + tracking code auto-save হয়ে invoice-এ আসবে।
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={checkSteadfast}
                disabled={checkingSf}
                className="rounded-full bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {checkingSf ? (
                  <>
                    <RefreshCw className="mr-1.5 size-4 animate-spin" /> যাচাই হচ্ছে...
                  </>
                ) : (
                  "Check চাপুন"
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { done: sfInputs.apiKey.length > 0, label: "১. Key বসানো" },
              { done: sfInputs.secretKey.length > 0, label: "২. Secret বসানো" },
              { done: sfInputs.enabled, label: "৩. Connected" },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
                  s.done
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-cream/50 text-muted-foreground"
                }`}
              >
                {s.done ? "✓ " : "○ "}{s.label}
              </div>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-red-200">
            <button
              type="button"
              onClick={() => setShowSfGuide((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-red-50 px-4 py-3 text-left text-sm font-bold text-ink hover:bg-red-100/60"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="size-4 text-red-600" />
                📖 সেটআপ গাইড — ধাপে ধাপে
              </span>
              <span className="text-red-600">{showSfGuide ? "▲" : "▼"}</span>
            </button>
            {showSfGuide && (
              <ol className="space-y-4 bg-white p-4 text-sm leading-relaxed text-ink">
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">১</span>
                  <div>
                    <b>Key নিন (একবারই):</b> Steadfast merchant প্যানেলে লগইন করে
                    <TgLink href="https://steadfast.com.bd/user/api">API পেজ খুলুন</TgLink>
                    → <b>Api-Key</b> + <b>Secret-Key</b> copy করে নিচের ঘরে paste করুন। (Key গোপন রাখুন।)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">২</span>
                  <div>
                    <b>Check চাপুন:</b> উপরের লাল বাটনে ক্লিক করুন — ব্যালেন্স দেখিয়ে <b>Connected ✓</b> এলে সেভ সম্পূর্ণ (এতে টাকা কাটে না, consignment বানায় না)।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">৩</span>
                  <div>
                    <b>One-click পাঠান:</b> প্রতিটা অর্ডারের পাশে <b>🚚 বাটন</b> চাপুন → consignment তৈরি হয়ে ID সবুজ ব্যাজে দেখাবে। একই অর্ডারে দুবার চাপলেও ডাবল consignment হবে না।
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">৪</span>
                  <div>
                    <b>Invoice প্রিন্ট:</b> Consignment ID + Tracking Code বড় করে invoice-এ আসবে — প্রিন্ট করে পার্সেলের উপর লাগিয়ে দিন।
                  </div>
                </li>
              </ol>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 p-3.5 sm:col-span-2">
              <div>
                <div className="text-sm font-semibold text-ink">Steadfast {sfInputs.enabled ? "চালু" : "বন্ধ"}</div>
                <p className="text-xs text-muted-foreground">Check করলেই অটো চালু হয়ে যাবে।</p>
              </div>
              <Switch checked={sfInputs.enabled} onCheckedChange={toggleSteadfast} />
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Api-Key *</label>
              <input
                type="password"
                value={sfInputs.apiKey}
                onChange={(e) => setSfInputs((cur) => ({ ...cur, apiKey: e.target.value }))}
                placeholder="Steadfast প্যানেল থেকে Api-Key"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">steadfast.com.bd → লগইন → API পেজ</p>
            </div>
            <div className="rounded-xl border border-border bg-cream/50 p-3.5">
              <label className="text-sm font-semibold text-ink">Secret-Key *</label>
              <input
                type="password"
                value={sfInputs.secretKey}
                onChange={(e) => setSfInputs((cur) => ({ ...cur, secretKey: e.target.value }))}
                placeholder="Steadfast প্যানেল থেকে Secret-Key"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-mono text-ink outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Key ভুল হলে Check-এ লাল error আসবে, সেভ হবে না</p>
            </div>
          </div>
        </div>

        {/* ShopBase BD fulfillment setup + one-click push */}
        <ShopbaseSetup initial={initialShopbase} />

        {/* ManyDial call automation setup + manual re-call */}
        <ManyDialSetup initial={initialManyDial} />

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
        <TabsContent value="customers">
          <div className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold text-ink">
                <Users className="size-5 text-brand" /> কাস্টমার ({toBn(customers.length)})
              </h2>
              <input
                value={custQuery}
                onChange={(e) => setCustQuery(e.target.value)}
                placeholder="নাম বা মোবাইল দিয়ে খুঁজুন…"
                className="h-10 rounded-full border border-border bg-cream/50 px-4 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  কোনো কাস্টমার পাওয়া যায়নি।
                </div>
              ) : (
                filteredCustomers.map((c) => {
                  const cOrders = orders.filter((o) => o.phone === c.phone);
                  const loc = [c.division, c.district, c.upazila].filter(Boolean).join(", ");
                  return (
                    <div key={c.phone} className="overflow-hidden rounded-xl border border-border">
                      <button
                        onClick={() => setExpandedPhone((cur) => (cur === c.phone ? null : c.phone))}
                        className="flex w-full flex-wrap items-center justify-between gap-2 p-3.5 text-left transition-colors hover:bg-cream/50"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-ink">{c.name || "(নাম নেই)"}</div>
                          <div className="text-sm text-muted-foreground">{c.phone}</div>
                        </div>
                        <div className="text-right text-sm">
                          <span className="font-bold text-brand">{toBn(c.orderCount)}টি অর্ডার</span>
                          <span className="block text-xs text-muted-foreground">
                            মোট ৳{toBn(c.totalSpent)}
                          </span>
                        </div>
                      </button>
                      {expandedPhone === c.phone && (
                        <div className="border-t border-border bg-cream/40 p-3.5 text-sm">
                          <p className="text-muted-foreground">{c.address}</p>
                          {loc && <p className="mt-0.5 font-medium text-ink">📍 {loc}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            প্রথম অর্ডার: {formatDate(c.firstOrderAt)} • শেষ: {formatDate(c.lastOrderAt)}
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {cOrders.length === 0 ? (
                              <p className="text-xs text-muted-foreground">কোনো অর্ডার নেই।</p>
                            ) : (
                              cOrders.map((o) => (
                                <div
                                  key={o.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"
                                >
                                  <span className="font-mono font-bold text-ink">{o.orderCode}</span>
                                  <span className="text-muted-foreground">
                                    {o.packageName} • {toBn(o.quantity)}টি
                                  </span>
                                  <span className="font-bold text-brand">৳{toBn(o.totalPrice)}</span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 font-bold ${STATUS_META[o.status]?.badge ?? STATUS_META.pending.badge}`}
                                  >
                                    {STATUS_META[o.status]?.label ?? o.status}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              setSelectedIds([]);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              selectMode
                ? "border-ink bg-ink text-white"
                : "border-border bg-white text-muted-foreground hover:border-brand/40"
            }`}
          >
            <Printer className="mr-1 inline size-3.5" />
            {selectMode ? "সিলেক্ট বন্ধ" : "🖨️ সিলেক্ট"}
          </button>
        </div>
        {selectMode && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink p-3 text-sm text-white">
            <span className="font-bold">{toBn(selectedIds.length)}টি সিলেক্টেড</span>
            <div className="ms-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => printSelected(2)}
                className="rounded-full bg-white font-bold text-ink hover:bg-cream disabled:opacity-50"
              >
                পেজে ২টা প্রিন্ট
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => printSelected(4)}
                className="rounded-full bg-white font-bold text-ink hover:bg-cream disabled:opacity-50"
              >
                পেজে ৪টা প্রিন্ট
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => printSelected(6)}
                className="rounded-full bg-white font-bold text-ink hover:bg-cream disabled:opacity-50"
              >
                পেজে ৬টা প্রিন্ট
              </Button>
            </div>
          </div>
        )}

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
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(o.id)}
                            onChange={() => toggleSelectOne(o.id)}
                            aria-label="প্রিন্টের জন্য সিলেক্ট"
                            className="size-5 accent-[#1c1917]"
                          />
                        )}
                        <span className="rounded-lg bg-cream px-2 py-0.5 font-mono text-xs font-bold text-ink">
                          {o.orderCode}
                        </span>
                        {o.consignmentId ? (
                          <span
                            title={o.trackingCode ? `Tracking: ${o.trackingCode}` : "Steadfast consignment তৈরি"}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800"
                          >
                            📦 {o.consignmentId}
                          </span>
                        ) : null}
                        {o.shopbaseOrderId ? (
                          <span
                            title="ShopBase BD-তে পাঠানো হয়েছে"
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2 py-0.5 font-mono text-xs font-bold text-indigo-800"
                          >
                            🛍️ {o.shopbaseOrderId}
                          </span>
                        ) : null}
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
                      {o.adminNote ? (
                        <p className="mt-1 max-w-xl rounded-lg bg-honey/15 px-2.5 py-1 text-sm leading-relaxed text-ink">
                          📝 <b>নোট:</b> {o.adminNote}
                        </p>
                      ) : null}
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
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditingOrder(o)}
                          title="অর্ডার এডিট"
                          className="grid size-9 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/admin/print?ids=${o.id}&per=2`, "_blank")}
                          title="ইনভয়েস প্রিন্ট"
                          className="grid size-9 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                        >
                          <Printer className="size-4" />
                        </button>
                        {!o.consignmentId && (
                          <button
                            onClick={() => sendToCourier(o.id)}
                            disabled={sendingSfId === o.id}
                            title="Steadfast-এ পাঠান (one-click consignment)"
                            className="grid size-9 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-60"
                          >
                            {sendingSfId === o.id ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <Truck className="size-4" />
                            )}
                          </button>
                        )}
                        {!o.shopbaseOrderId && (
                          <button
                            onClick={() => setShopbaseOrder(o)}
                            title="ShopBase BD-তে পাঠান (আগে যাচাই/এডিট)"
                            className="grid size-9 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-indigo-500 hover:text-indigo-600"
                          >
                            <ShoppingBag className="size-4" />
                          </button>
                        )}
                        {initialManyDial.enabled && o.status === "pending" && (
                          <button
                            onClick={() => recallManyDial(o.id)}
                            disabled={callingMdId === o.id}
                            title="কনফার্মেশন কল পাঠান (ManyDial)"
                            className="grid size-9 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-teal-500 hover:text-teal-600 disabled:opacity-60"
                          >
                            {callingMdId === o.id ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <PhoneOutgoing className="size-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(o.id)}
                          title={deleteArm === o.id ? "নিশ্চিত করতে আবার চাপুন" : "অর্ডার ডিলিট"}
                          className={`grid size-9 place-items-center rounded-full border transition-colors ${
                            deleteArm === o.id
                              ? "border-destructive bg-destructive text-white"
                              : "border-border bg-white text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                          }`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {deleteArm === o.id && (
                        <p className="text-xs font-bold text-destructive">
                          ডিলিট করতে আবার চাপুন
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </TabsContent>
        </Tabs>
        {editingOrder && (
          <OrderEditModal
            order={editingOrder}
            products={products}
            zones={config.zones}
            locationEnabled={locOn}
            onClose={() => setEditingOrder(null)}
            onSaved={(updated) => {
              setOrders((cur) => cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
              setEditingOrder(null);
              toast({ title: "অর্ডার আপডেট হয়েছে" });
            }}
          />
        )}
        {shopbaseOrder && (
          <OrderEditModal
            order={shopbaseOrder}
            products={products}
            zones={config.zones}
            locationEnabled={locOn}
            mode="shopbase"
            onClose={() => setShopbaseOrder(null)}
            onSaved={(updated) => {
              setOrders((cur) => cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            }}
            onShopbaseSent={(sbId) => {
              setOrders((cur) =>
                cur.map((x) =>
                  x.id === shopbaseOrder.id ? { ...x, shopbaseOrderId: sbId } : x
                )
              );
              setShopbaseOrder(null);
              toast({
                title: "ShopBase-এ অর্ডার গেছে ✓",
                description: `ShopBase ID: ${sbId}`,
              });
            }}
          />
        )}
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
