"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { CatalogItem, CatalogVariant } from "@/lib/catalog-shared";
import { toBn } from "@/lib/landing-data";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

/** Shape stored per variant in the form draft. */
type VariantDraft = Omit<CatalogVariant, "id"> & { id?: string };
/** Shape stored per product in the form draft. */
type ItemDraft = Omit<CatalogItem, "id" | "variants" | "createdAt"> & {
  id?: string; // undefined = new (not saved yet)
  createdAt?: string;
  variants: VariantDraft[];
};

function seedDraft(): ItemDraft {
  return {
    id: undefined,
    name: "",
    tagline: "",
    description: "",
    imageUrl: "",
    price: 0,
    oldPrice: 0,
    sku: "",
    shopbaseSku: "",
    size: "F",
    maxQty: 5,
    stock: 0,
    featured: false,
    featuredOrder: 0,
    active: true,
    sortOrder: 0,
    variants: [
      {
        name: "",
        label: "",
        colorHex: "",
        imageUrl: "",
        sku: "",
        shopbaseSku: "",
        price: null,
        oldPrice: null,
        stock: 0,
        active: true,
        sortOrder: 1,
      },
    ],
  };
}

const n = (v: string, fallback = 0): number => {
  const num = Math.round(Number(v));
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

export function CatalogManager({ initialItems }: { initialItems: CatalogItem[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/catalog", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json();
        if (res.ok && Array.isArray(data.items)) setItems(data.items);
      } catch {
        // keep initialItems as fallback
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const openNew = () => setDraft(seedDraft());
  const openEdit = (i: CatalogItem) =>
    setDraft({
      ...i,
      id: i.id,
      variants: i.variants.map((v) => ({ ...v })),
    });

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast({ title: "নাম দিন", description: "প্রোডাক্টের নাম খালি থাকতে পারবে না।", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        tagline: draft.tagline,
        description: draft.description,
        imageUrl: draft.imageUrl,
        price: n(String(draft.price)),
        oldPrice: n(String(draft.oldPrice)),
        sku: draft.sku,
        shopbaseSku: draft.shopbaseSku,
        size: draft.size || "F",
        maxQty: n(String(draft.maxQty), 5) || 5,
        stock: n(String(draft.stock)),
        featured: !!draft.featured,
        featuredOrder: n(String(draft.featuredOrder)),
        active: draft.active,
        sortOrder: n(String(draft.sortOrder)),
        variants: draft.variants.map((v) => ({
          id: v.id,
          name: v.name,
          label: v.label,
          colorHex: v.colorHex,
          imageUrl: v.imageUrl,
          sku: v.sku,
          shopbaseSku: v.shopbaseSku,
          price: v.price === null ? null : n(String(v.price)),
          oldPrice: v.oldPrice === null ? null : n(String(v.oldPrice)),
          stock: n(String(v.stock)),
          active: v.active,
          sortOrder: n(String(v.sortOrder)),
        })),
      };
      const url = draft.id ? `/api/admin/catalog/${encodeURIComponent(draft.id)}` : "/api/admin/catalog";
      const res = await fetch(url, {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি।");
      const saved = data.item as CatalogItem;
      setItems((cur) => {
        const exists = cur.some((i) => i.id === saved.id);
        const next = exists ? cur.map((i) => (i.id === saved.id ? saved : i)) : [...cur, saved];
        return [...next].sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) ||
            Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")
        );
      });
      setDraft(null);
      toast({ title: "✓ সেভ হয়েছে", description: `${saved.name} আপডেট হয়েছে।` });
    } catch (e) {
      toast({
        title: "সেভ হয়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("এই প্রোডাক্ট মুছে ফেলবেন? (পুরনো অর্ডার অক্ষত থাকবে)")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ডিলিট হয়নি।");
      setItems((cur) => cur.filter((i) => i.id !== id));
      if (draft?.id === id) setDraft(null);
      toast({ title: "✓ ডিলিট হয়েছে", description: "প্রোডাক্ট মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({
        title: "ডিলিট হয়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const setVar = (idx: number, patch: Partial<VariantDraft>) =>
    setDraft((d) =>
      d
        ? { ...d, variants: d.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)) }
        : d
    );

  /** Reorder variants (drag-drop + arrows). Saved order = display order. */
  const moveVariant = (from: number, to: number) =>
    setDraft((d) => {
      if (!d || to < 0 || to >= d.variants.length || from === to) return d;
      const next = [...d.variants];
      const [v] = next.splice(from, 1);
      next.splice(to, 0, v);
      return { ...d, variants: next };
    });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-cream/60 pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-bold text-ink">
                <Package className="mr-1.5 inline size-5 text-brand" />
                প্রোডাক্ট ক্যাটালগ
              </h1>
              <p className="text-xs text-muted-foreground">
                সব প্রোডাক্ট, SKU, ভ্যারিয়েন্ট ও দাম — সব এখান থেকে
              </p>
            </div>
          </div>
          <Button onClick={openNew} className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep">
            <PackagePlus className="mr-1.5 size-4" /> নতুন প্রোডাক্ট
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 pt-6">
        {/* Product list */}
        {loading ? (
          <div className="grid place-items-center rounded-2xl border border-border bg-white p-10 text-muted-foreground">
            <Loader2 className="mb-2 size-5 animate-spin" /> প্রোডাক্ট লোড হচ্ছে…
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-cream">
                    {(item.imageUrl || item.variants[0]?.imageUrl) ? (
                      <img src={item.imageUrl || item.variants[0]?.imageUrl} alt={item.name} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{item.name}</span>
                      {item.featured ? (
                        <span className="rounded-full bg-honey/20 px-2 py-0.5 text-[11px] font-bold text-honey">
                          ⭐ ফিচার্ড
                        </span>
                      ) : null}
                      {!item.active ? (
                        <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                          নিষ্ক্রিয়
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ৳{toBn(item.price)} • {item.variants.length}টি ভ্যারিয়েন্ট
                      {item.stock > 0 ? ` • স্টক ${toBn(item.stock)}` : " • স্টক সীমাহীন"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-full font-semibold" onClick={() => openEdit(item)}>
                      সম্পাদনা
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleting === item.id}
                      aria-label="ডিলিট"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => void deleteItem(item.id)}
                    >
                      {deleting === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit / create form */}
        {draft && (
          <section className="rounded-2xl border-2 border-brand/40 bg-white p-5 shadow-lg sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-ink">
                {draft.id ? `সম্পাদনা: ${draft.name || "…"}` : "নতুন প্রোডাক্ট"}
              </h2>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setDraft(null)} disabled={saving}>
                বাতিল
              </Button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold">প্রোডাক্টের নাম *</Label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  placeholder="যেমন: হুডি বেবি সোয়াডেল"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold">ট্যাগলাইন (ছোট লাইন)</Label>
                <input
                  value={draft.tagline}
                  onChange={(e) => setDraft((d) => (d ? { ...d, tagline: e.target.value } : d))}
                  placeholder="যেমন: কিউট এমব্রয়ডারি ডিজাইন"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-semibold">বিস্তারিত বর্ণনা</Label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                  rows={3}
                  placeholder="পণ্যের বিশেষত্ব, মাপ, উপকরণ…"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            {/* Product image */}
            <div className="mt-4">
              <Label className="text-sm font-semibold">প্রোডাক্টের ছবি</Label>
              <div className="mt-2 max-w-52">
                <ImageUploader
                  url={draft.imageUrl}
                  onUrl={(url) => setDraft((d) => (d ? { ...d, imageUrl: url } : d))}
                  aspectClass="aspect-[4/3]"
                />
              </div>
            </div>

            {/* Pricing + stock (selling price comes from the settings tier table) */}
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-sm font-semibold">পুরনো দাম (৳, কাটা দাম)</Label>
                <input type="number" value={draft.oldPrice || ""} onChange={(e) => setDraft((d) => (d ? { ...d, oldPrice: n(e.target.value) } : d))} className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <Label className="text-sm font-semibold">SKU</Label>
                <input value={draft.sku} onChange={(e) => setDraft((d) => (d ? { ...d, sku: e.target.value } : d))} placeholder="GP-XXX" className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <Label className="text-sm font-semibold">ShopBase SKU</Label>
                <input value={draft.shopbaseSku} onChange={(e) => setDraft((d) => (d ? { ...d, shopbaseSku: e.target.value } : d))} placeholder="33100" className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <Label className="text-sm font-semibold">সাইজ</Label>
                <input value={draft.size} onChange={(e) => setDraft((d) => (d ? { ...d, size: e.target.value } : d))} placeholder="F" className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <Label className="text-sm font-semibold">এক অর্ডারে সর্বোচ্চ</Label>
                <input type="number" value={draft.maxQty || ""} onChange={(e) => setDraft((d) => (d ? { ...d, maxQty: n(e.target.value, 5) } : d))} className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <Label className="text-sm font-semibold">স্টক (০ = সীমাহীন)</Label>
                <input type="number" value={draft.stock || ""} onChange={(e) => setDraft((d) => (d ? { ...d, stock: n(e.target.value) } : d))} className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
      <div>
        <Label className="text-sm font-semibold">ফিচার্ড ক্রম (ছোট আগে)</Label>
        <input type="number" value={draft.featuredOrder || ""} onChange={(e) => setDraft((d) => (d ? { ...d, featuredOrder: n(e.target.value) } : d))} placeholder="0" className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
      </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 বিক্রয় দাম settings-এর দামের table (tier) থেকে auto আসে — সবার জন্য এক দাম।
            </p>

            {/* Toggles */}
            <div className="mt-4 flex flex-wrap gap-6 rounded-xl border border-border bg-cream/40 p-3.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Switch
                  checked={draft.featured}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, featured: v } : d))}
                  className="data-[state=checked]:bg-brand"
                />
                ⭐ ফিচার্ড (বিশেষ অফারে দেখান)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Switch
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, active: v } : d))}
                  className="data-[state=checked]:bg-brand"
                />
                বিক্রি সচল
              </label>
            </div>

            {/* Variants */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">ভ্যারিয়েন্ট (কালার/ডিজাইন) — {draft.variants.length}টি</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            // Prepend — new variants show on top.
                            variants: [
                              { name: "", label: "", colorHex: "", imageUrl: "", sku: "", shopbaseSku: "", price: null, oldPrice: null, stock: 0, active: true, sortOrder: 0 },
                              ...d.variants,
                            ],
                          }
                        : d
                    )
                  }
                >
                  <Plus className="mr-1 size-4" /> ভ্যারিয়েন্ট যোগ করুন
                </Button>
              </div>
              <div className="mt-2.5 space-y-4">
                {draft.variants.map((v, idx) => (
                  <div
                    key={v.id ?? `new-${idx}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIdx(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      if (Number.isFinite(from)) moveVariant(from, idx);
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    className={`rounded-xl border bg-white p-3.5 transition-shadow ${
                      overIdx === idx ? "border-brand shadow-md shadow-brand/20" : "border-border"
                    } ${dragIdx === idx ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="টেনে সাজান"
                          aria-label="টেনে সাজান"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", String(idx));
                            e.dataTransfer.effectAllowed = "move";
                            setDragIdx(idx);
                          }}
                          onDragEnd={() => {
                            setDragIdx(null);
                            setOverIdx(null);
                          }}
                          className="grid size-7 cursor-grab place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand hover:text-brand active:cursor-grabbing"
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          # {toBn(idx + 1)}
                        </span>
                        <div className="flex items-center">
                          <button
                            type="button"
                            title="উপরে নিন"
                            aria-label="উপরে নিন"
                            disabled={idx === 0}
                            onClick={() => moveVariant(idx, idx - 1)}
                            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-cream hover:text-brand disabled:opacity-30"
                          >
                            <ChevronUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="নিচে নিন"
                            aria-label="নিচে নিন"
                            disabled={idx === draft.variants.length - 1}
                            onClick={() => moveVariant(idx, idx + 1)}
                            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-cream hover:text-brand disabled:opacity-30"
                          >
                            <ChevronDown className="size-4" />
                          </button>
                        </div>
                      </div>
                      {draft.variants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDraft((d) =>
                              d ? { ...d, variants: d.variants.filter((_, i) => i !== idx) } : d
                            )
                          }
                        >
                          <Trash2 className="mr-1 size-3.5" /> সরান
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">ভ্যারিয়েন্ট নাম *</Label>
                        <input value={v.name} onChange={(e) => setVar(idx, { name: e.target.value })} placeholder="বাদামি" className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">লেবেল (display)</Label>
                        <input value={v.label} onChange={(e) => setVar(idx, { label: e.target.value })} placeholder="বাদামি" className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">কালার হেক্স</Label>
                        <input value={v.colorHex} onChange={(e) => setVar(idx, { colorHex: e.target.value })} placeholder="#A0724A" dir="ltr" className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 font-mono text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">SKU</Label>
                        <input value={v.sku} onChange={(e) => setVar(idx, { sku: e.target.value })} className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 font-mono text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">ShopBase SKU</Label>
                        <input value={v.shopbaseSku} onChange={(e) => setVar(idx, { shopbaseSku: e.target.value })} className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 font-mono text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">পুরনো দাম (কাটা দাম)</Label>
                        <input type="number" value={v.oldPrice === null ? "" : v.oldPrice} onChange={(e) => setVar(idx, { oldPrice: e.target.value === "" ? null : n(e.target.value) })} className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 text-sm outline-none focus:border-brand" />
                      </div>
                      <div>
                        <Label className="text-xs">স্টক (০ = সীমাহীন)</Label>
                        <input type="number" value={v.stock || ""} onChange={(e) => setVar(idx, { stock: n(e.target.value) })} className="mt-0.5 h-9 w-full rounded-lg border border-border px-2.5 text-sm outline-none focus:border-brand" />
                      </div>
                      <label className="flex items-center gap-2 pt-5 text-sm font-semibold">
                        <Switch checked={v.active} onCheckedChange={(chk) => setVar(idx, { active: chk })} className="data-[state=checked]:bg-brand" />
                        বিক্রি
                      </label>
                    </div>
                    <div className="mt-2 max-w-40">
                      <Label className="text-xs">ভ্যারিয়েন্ট ছবি (ঐচ্ছিক)</Label>
                      <ImageUploader url={v.imageUrl} onUrl={(url) => setVar(idx, { imageUrl: url })} aspectClass="aspect-[4/3]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => void saveDraft()}
                disabled={saving}
                className="rounded-full bg-brand px-8 font-bold text-white hover:bg-brand-deep disabled:opacity-60"
              >
                {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                {draft.id ? "পরিবর্তন সেভ করুন" : "প্রোডাক্ট তৈরি করুন"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}