"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toBn } from "@/lib/landing-data";
import {
  parseOrderItems,
  type CatalogItem,
  type OrderLineItem,
} from "@/lib/catalog-shared";
import {
  colorIdsFromOrder,
  resolveColorMeta,
  resolveLineImage,
  type ColorMeta,
} from "@/lib/color-resolve";
import {
  Pencil,
  Phone,
  Printer,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";

export type DetailOrder = {
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
  consignmentId: string;
  trackingCode: string;
  shopbaseOrderId: string;
  adminNote: string;
  items?: string;
  createdAt: string | Date;
};

function LineThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-border bg-cream text-2xl">
        🛍️
      </div>
    );
  }
  return (
    // Plain <img>: catalog photos may live on R2/external hosts.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className="size-16 shrink-0 rounded-xl border border-border object-cover"
    />
  );
}

function GhumparaColors({
  line,
  colorMap,
}: {
  line: OrderLineItem;
  colorMap: Map<string, ColorMeta>;
}) {
  const ids = (line.colorIds ?? []).filter(Boolean);
  if (ids.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {ids.map((cid, i) => {
        const meta = resolveColorMeta(colorMap, cid);
        return (
          <span
            key={`${cid}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white py-0.5 pl-1 pr-2.5 text-xs font-bold text-ink"
          >
            <span
              className="size-4 rounded-full border border-black/10"
              style={{ backgroundColor: meta.hex }}
            />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

export function OrderDetailModal({
  order,
  colorMap,
  catalogItems,
  zoneLabel,
  statusOptions,
  statusMeta,
  statusBusy,
  courierBusy,
  canCourier,
  canShopbase,
  onClose,
  onStatusChange,
  onEdit,
  onPrint,
  onCourier,
  onShopbase,
  onDelete,
}: {
  order: DetailOrder;
  colorMap: Map<string, ColorMeta>;
  catalogItems: CatalogItem[];
  zoneLabel: string;
  statusOptions: { value: string; label: string }[];
  statusMeta: { label: string; badge: string };
  statusBusy: boolean;
  courierBusy: boolean;
  canCourier: boolean;
  canShopbase: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onPrint: () => void;
  onCourier: () => void;
  onShopbase: () => void;
  onDelete: () => void;
}) {
  const [deleteArm, setDeleteArm] = useState(false);
  const lines = parseOrderItems(order.items);
  const legacyIds = lines.length === 0 ? colorIdsFromOrder(order) : [];
  const loc = [order.division, order.district, order.upazila].filter(Boolean).join(", ");
  const productTotal = order.totalPrice - order.deliveryCharge;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[1.5rem]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink">
            <span className="rounded-lg bg-cream px-2 py-0.5 font-mono text-sm font-bold">
              {order.orderCode}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusMeta.badge}`}>
              {statusMeta.label}
            </span>
            {order.shopbaseOrderId ? (
              <span className="rounded-lg bg-indigo-100 px-2 py-0.5 font-mono text-xs font-bold text-indigo-800">
                🛍️ {order.shopbaseOrderId}
              </span>
            ) : null}
            {order.consignmentId ? (
              <span className="rounded-lg bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                📦 {order.consignmentId}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="rounded-2xl border border-border bg-cream/50 p-4">
            <div className="font-bold text-ink">{order.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`tel:+88${order.phone}`} className="font-semibold text-brand hover:underline">
                <Phone className="mr-1 inline size-3.5" />
                {order.phone}
              </a>
              <a
                href={`https://wa.me/88${order.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#128C4B] hover:underline"
              >
                WhatsApp
              </a>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{order.address}</p>
            {loc ? <p className="mt-0.5 text-sm font-medium text-ink">📍 {loc}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("bn-BD", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {order.adminNote ? (
              <p className="mt-2 rounded-xl bg-honey/15 px-3 py-1.5 text-sm text-ink">
                📝 <b>নোট:</b> {order.adminNote}
              </p>
            ) : null}
          </div>

          {/* Items */}
          <div>
            <div className="text-sm font-bold text-ink">
              🛍️ অর্ডারের পণ্য ({toBn(order.quantity)}টি)
            </div>
            <div className="mt-2 space-y-2">
              {lines.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                  <LineThumb
                    src={colorMap.get(legacyIds[0] ?? "")?.image ?? ""}
                    alt={order.packageName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">
                      {order.packageName} ×{toBn(order.quantity)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {legacyIds.map((cid, i) => {
                        const meta = resolveColorMeta(colorMap, cid);
                        return (
                          <span
                            key={`${cid}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white py-0.5 pl-1 pr-2.5 text-xs font-bold text-ink"
                          >
                            <span
                              className="size-4 rounded-full border border-black/10"
                              style={{ backgroundColor: meta.hex }}
                            />
                            {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-ink">
                    ৳{toBn(productTotal)}
                  </div>
                </div>
              ) : (
                lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
                  >
                    <LineThumb
                      src={resolveLineImage(l, catalogItems, colorMap)}
                      alt={`${l.name}${l.variant ? ` (${l.variant})` : ""}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink">
                        {l.name}
                        {l.variant ? (
                          <span className="font-semibold text-muted-foreground"> ({l.variant})</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        ৳{toBn(l.unitPrice)}/পিস × {toBn(l.qty)}টি
                      </div>
                      {l.productId === "ghumpara" ? (
                        <GhumparaColors line={l} colorMap={colorMap} />
                      ) : null}
                    </div>
                    <div className="shrink-0 text-sm font-bold text-ink">
                      ৳{toBn(l.qty * l.unitPrice)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-2xl bg-cream p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">পণ্যের মূল্য</span>
              <span className="font-semibold text-ink">৳{toBn(productTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">
                ডেলিভারি{zoneLabel ? ` (${zoneLabel})` : ""}
              </span>
              <span className={`font-semibold ${order.deliveryCharge > 0 ? "text-ink" : "text-leaf"}`}>
                {order.deliveryCharge > 0 ? `৳${toBn(order.deliveryCharge)}` : "ফ্রি! 🎉"}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
              <span className="font-bold text-ink">সর্বমোট</span>
              <span className="font-bold text-brand">৳{toBn(order.totalPrice)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">স্ট্যাটাস:</span>
            <select
              value={order.status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={statusBusy}
              className="h-10 rounded-full border-2 border-border bg-white px-4 text-sm font-bold text-ink outline-none focus:border-brand disabled:opacity-60"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onEdit} variant="outline" className="rounded-full">
              <Pencil className="mr-1.5 size-4" /> এডিট
            </Button>
            <Button onClick={onPrint} variant="outline" className="rounded-full">
              <Printer className="mr-1.5 size-4" /> প্রিন্ট
            </Button>
            {canCourier ? (
              <Button
                onClick={onCourier}
                variant="outline"
                disabled={courierBusy}
                className="rounded-full hover:border-red-500 hover:text-red-600 disabled:opacity-60"
              >
                <Truck className="mr-1.5 size-4" />
                {courierBusy ? "পাঠানো হচ্ছে..." : "Steadfast-এ পাঠান"}
              </Button>
            ) : null}
            {canShopbase ? (
              <Button
                onClick={onShopbase}
                className="rounded-full bg-indigo-600 font-bold text-white hover:bg-indigo-700"
              >
                <ShoppingBag className="mr-1.5 size-4" /> ShopBase-এ পাঠান
              </Button>
            ) : null}
            <Button
              onClick={() => {
                if (deleteArm) onDelete();
                else {
                  setDeleteArm(true);
                  setTimeout(() => setDeleteArm(false), 4000);
                }
              }}
              variant="outline"
              className={`ml-auto rounded-full ${deleteArm ? "border-destructive bg-destructive text-white hover:bg-destructive" : "hover:border-destructive/50 hover:text-destructive"}`}
            >
              <Trash2 className="mr-1.5 size-4" />
              {deleteArm ? "নিশ্চিত? আবার চাপুন" : "ডিলিট"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
