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
import { PACKAGE_META, type ProductConfig } from "@/lib/product-shared";
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

function parsePackage(
  packageName: string,
  quantity: number
): { packageId: string; count: number } {
  if (packageName.startsWith("কাস্টম")) {
    return { packageId: "custom", count: Math.min(Math.max(quantity, 1), 30) };
  }
  for (const [id, meta] of Object.entries(PACKAGE_META)) {
    if (id === "custom") continue;
    if (packageName.startsWith(meta.formName)) {
      return {
        packageId: id,
        count: Math.min(Math.max(Math.round(quantity / meta.quantity) || 1, 1), 10),
      };
    }
  }
  return { packageId: "single", count: 1 };
}

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OrderEditModal({
  order,
  products,
  zones,
  locationEnabled,
  onClose,
  onSaved,
}: {
  order: EditableOrder;
  products: ProductConfig;
  zones: DeliveryZone[];
  locationEnabled: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (updated: any) => void;
}) {
  const initial = parsePackage(order.packageName, order.quantity);
  const [name, setName] = useState(order.name);
  const [phone, setPhone] = useState(order.phone);
  const [address, setAddress] = useState(order.address);
  const [packageId, setPackageId] = useState(initial.packageId);
  const [count, setCount] = useState(initial.count);
  const [colors, setColors] = useState<string[]>(
    parseColors(order.colors, order.color)
  );
  const [zone, setZone] = useState(order.deliveryZone);
  const [location, setLocation] = useState<LocationSelection>({
    division: order.division,
    district: order.district,
    upazila: order.upazila,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkgPrice = products.packages.find((p) => p.id === packageId)?.price ?? 0;
  const isCustom = packageId === "custom";
  const maxCount = isCustom ? 30 : 10;
  const totalItems = isCustom
    ? count
    : (PACKAGE_META[packageId as keyof typeof PACKAGE_META]?.quantity ?? 1) * count;
  const needsZone = zones.some((z) => z.charge > 0);
  const charge = needsZone ? zoneCharge({ zones }, zone) : 0;
  const previewTotal = pkgPrice * count + charge;

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
            packageId,
            count,
            colors,
            zone,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "সেভ হয়নি। আবার চেষ্টা করুন।");
        return;
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
            ✏️ অর্ডার এডিট করুন
          </DialogTitle>
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
              <select
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                className={`${inputCls} h-11`}
              >
                {products.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {PACKAGE_META[p.id].priceName} — ৳{toBn(p.price)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{isCustom ? "পিস সংখ্যা (১–৩০)" : "সেট সংখ্যা (×১–১০)"}</Label>
              <Input
                type="number"
                min={1}
                max={maxCount}
                value={count}
                onChange={(e) =>
                  setCount(Math.min(Math.max(Number(e.target.value) || 1, 1), maxCount))
                }
                className={inputCls}
              />
            </div>
          </div>
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
            <Button variant="outline" onClick={onClose} className="rounded-full">
              বাতিল
            </Button>
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
                "সেভ করুন"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
