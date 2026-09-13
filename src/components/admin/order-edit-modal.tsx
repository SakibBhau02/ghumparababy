"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRODUCT_COLORS, toBn } from "@/lib/landing-data";
import {
  MAX_QTY,
  isFreeShipping,
  packageNameForQty,
  priceForQty,
  type ProductConfig,
} from "@/lib/product-shared";
import { zoneCharge, type DeliveryZone } from "@/lib/delivery-shared";
import { AddressCascade } from "@/components/landing/address-cascade";
import type { LocationSelection } from "@/lib/bd-geo";
import { Loader2 } from "lucide-react";

export type EditableOrder = {
  id: string;
  name: string;
  phone: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  colors: string;
  color: string;
  adminNote: string;
  packageName: string;
  quantity: number;
  deliveryZone: string;
};

function parseColors(raw: string, fallback: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      const ids = arr.filter((c): c is string => typeof c === "string");
      if (ids.length > 0) return ids;
    }
  } catch {
    // fall through
  }
  return [fallback];
}

function parseQty(quantity: number): number {
  return Math.min(Math.max(Math.round(quantity) || 1, 1), 30);
}

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OrderEditModal({
  order,
  products,
  zones,
  locationEnabled,
  mode = "edit",
  onClose,
  onSaved,
  onShopbaseSent,
}: {
  order: EditableOrder;
  products: ProductConfig;
  zones: DeliveryZone[];
  locationEnabled: boolean;
  /** "edit" = save only; "shopbase" = save then push to ShopBase BD. */
  mode?: "edit" | "shopbase";
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (updated: any) => void;
  /** shopbase mode only — receives the ShopBase order ID after a successful push. */
  onShopbaseSent?: (shopbaseOrderId: string) => void;
}) {
  const initial = parseQty(order.quantity);
  const [name, setName] = useState(order.name);
  const [phone, setPhone] = useState(order.phone);
  const [address, setAddress] = useState(order.address);
  const [qty, setQty] = useState(initial);
  const [colors, setColors] = useState<string[]>(
    parseColors(order.colors, order.color)
  );
  const [adminNote, setAdminNote] = useState(order.adminNote ?? "");
  const [zone, setZone] = useState(order.deliveryZone);
  const [location, setLocation] = useState<LocationSelection>({
    division: order.division,
    district: order.district,
    upazila: order.upazila,
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { perPiece, total: itemsTotal } = priceForQty(products, qty);
  const totalItems = qty;
  const needsZone = zones.some((z) => z.charge > 0);
  const charge = needsZone ? (isFreeShipping(qty) ? 0 : zoneCharge({ zones }, zone)) : 0;
  const previewTotal = itemsTotal + charge;

  // Keep one color slot per item
  useEffect(() => {
    setColors((cur) => {
      if (cur.length === totalItems) return cur;
      if (cur.length > totalItems) return cur.slice(0, totalItems);
      return [...cur, ...Array<string>(totalItems - cur.length).fill("pink")];
    });
  }, [totalItems]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          edit: {
            name,
            phone,
            address,
            division: location.division,
            district: location.district,
            upazila: location.upazila,
            qty,
            colors,
            zone,
            note: adminNote,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "সেভ হয়নি। আবার চেষ্টা করুন।");
        return;
      }

      // shopbase mode: edits saved → now push the (fresh) order to ShopBase.
      if (mode === "shopbase") {
        setSending(true);
        try {
          const push = await fetch("/api/admin/shopbase/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
          });
          const pushData = await push.json();
          if (!push.ok) {
            // Edits ARE saved — show the push error but still refresh the card.
            onSaved(data.order);
            setError(pushData.error ?? "ShopBase-এ পাঠানো যায়নি। আবার চেষ্টা করুন।");
            return;
          }
          onShopbaseSent?.(pushData.shopbaseOrderId ?? "");
        } catch {
          onSaved(data.order);
          setError("নেটওয়ার্ক সমস্যা — ShopBase-এ যায়নি। আবার চেষ্টা করুন।");
          return;
        } finally {
          setSending(false);
        }
      }

      onSaved(data.order);
    } catch {
      setError("নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[1.5rem]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-ink">
            {mode === "shopbase" ? "🛍️ ShopBase-এ পাঠান — আগে যাচাই/এডিট করুন" : "✏️ অর্ডার এডিট করুন"}
          </DialogTitle>
          {mode === "shopbase" && (
            <p className="text-sm font-normal text-muted-foreground">
              কিছু বদলাতে চাইলে করুন — না চাইলে তারপরও <b>পাঠিয়ে দিন</b> চাপুন। এডিটগুলো আগে সেভ হয়ে তারপর ShopBase BD-তে যাবে।
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>নাম *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label>মোবাইল *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <Label>ঠিকানা *</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="mt-1.5 rounded-xl border-border" />
          </div>
          {locationEnabled && (
            <AddressCascade value={location} onChange={setLocation} title="এলাকা" />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>প্যাকেজ</Label>
              <div className={`${inputCls} flex h-11 items-center font-bold`}>
                {packageNameForQty(qty)}
              </div>
            </div>
            <div>
              <Label>পিস সংখ্যা (১–৩০)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={qty}
                onChange={(e) =>
                  setQty(Math.min(Math.max(Number(e.target.value) || 1, 1), 30))
                }
                className={inputCls}
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            ৳{toBn(perPiece)}/পিস {isFreeShipping(qty) ? "• ৩+ পিসে ডেলিভারি ফ্রি 🎉" : `• আরও ${toBn(3 - qty)}টি নিলে ডেলিভারি ফ্রি`} • সর্বোচ্চ নতুন অর্ডার {toBn(MAX_QTY)}টি
          </p>
          <div>
            <Label>কালার ({toBn(totalItems)}টি)</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {colors.map((col, i) => (
                <div key={i}>
                  <span className="text-xs text-muted-foreground">{toBn(i + 1)} নং</span>
                  <select
                    value={col}
                    onChange={(e) =>
                      setColors((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    className={`${inputCls} mt-0.5 h-10 text-sm`}
                  >
                    {PRODUCT_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>📝 Admin নোট <span className="font-normal text-muted-foreground">(শুধু আপনার জন্য — কাস্টমার/invoice-তে যাবে না)</span></Label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="যেমন: ২বার কল, ধরেনি — সন্ধ্যায় আবার কল দিতে হবে"
              className="mt-1.5 rounded-xl border-border"
            />
          </div>
          {needsZone && (
            <div>
              <Label>ডেলিভারি এলাকা</Label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className={`${inputCls} h-11`}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label} — {z.charge > 0 ? `৳${toBn(z.charge)}` : "ফ্রি"}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-cream p-4">
            <span className="font-bold text-ink">সর্বমোট</span>
            <span className="text-xl font-bold text-brand">৳{toBn(previewTotal)}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-full" disabled={sending}>
              বাতিল
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className={`rounded-full font-bold text-white disabled:opacity-60 ${
                mode === "shopbase"
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-brand hover:bg-brand-deep"
              }`}
            >
              {saving || sending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  {mode === "shopbase" ? "পাঠানো হচ্ছে..." : "সেভ হচ্ছে..."}
                </>
              ) : mode === "shopbase" ? (
                "🛍️ সেভ করে ShopBase-এ পাঠান"
              ) : (
                "সেভ করুন"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
