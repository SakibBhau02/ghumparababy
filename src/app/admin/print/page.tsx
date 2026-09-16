import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getDeliveryConfig } from "@/lib/delivery";
import { getProductConfig } from "@/lib/product";
import { skusForOrder, type ProductConfig } from "@/lib/product-shared";
import {
  getCatalogProduct,
  parseOrderItems,
  skuLabelForMixed,
} from "@/lib/catalog-shared";
import { PRODUCT_COLORS, toBn, HOTLINE } from "@/lib/landing-data";
import { siteImage } from "@/lib/site-images";
import { PrintButton } from "@/components/admin/print-button";
import type { Order } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ইনভয়েস প্রিন্ট — ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

const STATUS_BN: Record<string, string> = {
  pending: "পেন্ডিং",
  confirmed: "কনফার্মড",
  shipped: "শিপমেন্টে",
  delivered: "ডেলিভার্ড",
  cancelled: "বাতিল",
};

function colorIds(order: Order): string[] {
  try {
    const arr = JSON.parse(order.colors) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter((c): c is string => typeof c === "string");
    }
  } catch {
    // fall through
  }
  return [order.color];
}

function colorMeta(id: string): { label: string; hex: string } {
  const found = PRODUCT_COLORS.find((c) => c.id === id);
  return { label: found?.label ?? id, hex: found?.hex ?? "#CCCCCC" };
}

function productImage(order: Order): string {
  const first = colorIds(order)[0] ?? order.color;
  const rel = PRODUCT_COLORS.find((c) => c.id === first)?.image ?? "/images/swaddle-pink.jpg";
  return siteImage(rel);
}

function locationLine(order: Order): string {
  return [order.division, order.district, order.upazila].filter(Boolean).join(", ");
}

function Invoice({
  order,
  zoneLabel,
  zoneNote,
  compact,
  sku,
  productConfig,
}: {
  order: Order;
  zoneLabel: string;
  zoneNote: string;
  compact: boolean;
  sku: string;
  productConfig: ProductConfig;
}) {
  const colors = colorIds(order);
  const loc = locationLine(order);
  return (
    <div className="invoice overflow-hidden rounded-xl border-2 border-ink bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-ink bg-cream px-3 py-1.5">
        <div>
          <div className={`font-bold text-ink ${compact ? "text-sm" : "text-lg"}`}>
            🧸 ঘুমপাড়া বেবি — ক্যাশ মেমো
          </div>
          <div className="text-[11px] text-muted-foreground">হটলাইন: {HOTLINE}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-ink">{order.orderCode}</div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("bn-BD", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            • {STATUS_BN[order.status] ?? order.status}
          </div>
        </div>
      </div>

      {/* Courier consignment — big, for sticking on the parcel */}
      {order.consignmentId ? (
        <div className="border-b-2 border-ink bg-ink px-3 py-1.5 text-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <div className={`font-mono font-bold ${compact ? "text-lg" : "text-2xl"}`}>
              📦 {order.consignmentId}
            </div>
            {order.trackingCode ? (
              <div className={`font-mono font-bold ${compact ? "text-sm" : "text-base"}`}>
                {order.trackingCode}
              </div>
            ) : null}
          </div>
          <div className="text-[11px] font-semibold text-white/80">
            Steadfast কুরিয়ার • COD ৳{toBn(order.totalPrice)}
          </div>
        </div>
      ) : null}

      {/* Customer */}
      <div className="grid grid-cols-2 gap-2 px-3 py-1.5 text-xs">
        <div>
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">ক্রেতা</div>
          <div className="font-bold text-ink">{order.name}</div>
          <div className="font-semibold">📞 {order.phone}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">ডেলিভারি ঠিকানা</div>
          <div>{order.address}</div>
          {loc && <div className="font-medium text-ink">{loc}</div>}
          {zoneLabel && <div className="text-muted-foreground">({zoneLabel})</div>}
          {zoneNote && <div className="mt-0.5 text-[11px] font-medium text-ink">📝 {zoneNote}</div>}
        </div>
      </div>

      {/* Items — full detail */}
      <table className="w-full border-t-2 border-ink text-xs">
        <thead>
          <tr className="bg-cream text-left text-muted-foreground">
            <th className="px-3 py-1 font-semibold">পণ্যের বিবরণ</th>
            <th className="px-2 py-1 text-center font-semibold">পরিমাণ</th>
            <th className="px-2 py-1 text-right font-semibold">দর (পিস)</th>
            <th className="px-3 py-1 text-right font-semibold">মোট</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const lines = parseOrderItems(order.items);
            // Legacy orders: today's exact single-row layout (unchanged).
            if (lines.length === 0) {
              return (
                <tr className="border-t border-border align-top">
                  <td className="px-3 py-1.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={`relative block shrink-0 overflow-hidden rounded-md border border-border ${compact ? "size-9" : "size-12"}`}
                      >
                        <Image
                          src={productImage(order)}
                          alt="সোয়াডেল"
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </span>
                      <span>
                        <span className="font-bold text-ink">{order.packageName}</span>
                        {sku ? (
                          <span className="mt-0.5 block font-mono text-[11px] font-bold text-muted-foreground">
                            SKU: {sku}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block font-semibold text-ink">
                          কালার ({toBn(colors.length)}টি):
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                          {colors.map((id, i) => {
                            const meta = colorMeta(id);
                            return (
                              <span key={`${id}-${i}`} className="inline-flex items-center gap-1">
                                <span
                                  className="inline-block size-3 rounded-[3px] border border-black/30"
                                  style={{ backgroundColor: meta.hex }}
                                />
                                <span>
                                  {toBn(i + 1)}. {meta.label}
                                </span>
                              </span>
                            );
                          })}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold">{toBn(order.quantity)}টি</td>
                  <td className="px-2 py-1.5 text-right">৳{toBn(order.unitPrice)}</td>
                  <td className="px-3 py-1.5 text-right font-bold">
                    ৳{toBn(order.unitPrice * order.quantity)}
                  </td>
                </tr>
              );
            }
            // Mixed orders: one row per line item.
            return (
              <>
                {lines.map((l, i) => {
                  const cat = getCatalogProduct(l.productId);
                  const img = cat?.image ?? productImage(order);
                  const lineSku = l.shopbaseSku
                    ? `${l.shopbaseSku} ×${l.qty}`
                    : skusForOrder(productConfig, l.qty, l.colorIds ?? []).join(", ");
                  return (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-3 py-1.5">
                        <div className="flex items-start gap-2">
                          <span
                            className={`relative block shrink-0 overflow-hidden rounded-md border border-border ${compact ? "size-9" : "size-12"}`}
                          >
                            <Image
                              src={img}
                              alt={l.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </span>
                          <span>
                            <span className="font-bold text-ink">
                              {l.name}
                              {l.variant ? ` (${l.variant})` : ""}
                            </span>
                            <span className="mt-0.5 block font-mono text-[11px] font-bold text-muted-foreground">
                              SKU: {l.shopbaseSku ? `${l.shopbaseSku} ×${l.qty}` : lineSku || sku}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold">{toBn(l.qty)}টি</td>
                      <td className="px-2 py-1.5 text-right">৳{toBn(l.unitPrice)}</td>
                      <td className="px-3 py-1.5 text-right font-bold">
                        ৳{toBn(l.unitPrice * l.qty)}
                      </td>
                    </tr>
                  );
                })}
              </>
            );
          })()}
          <tr className="border-t border-border">
            <td colSpan={3} className="px-3 py-1 text-right text-muted-foreground">
              ডেলিভারি চার্জ{zoneLabel ? ` (${zoneLabel})` : ""}
            </td>
            <td className="px-3 py-1 text-right font-semibold">
              {order.deliveryCharge > 0 ? `৳${toBn(order.deliveryCharge)}` : "ফ্রি"}
            </td>
          </tr>
          <tr className="border-t-2 border-ink bg-cream">
            <td colSpan={3} className="px-3 py-1.5 text-right font-bold text-ink">
              সর্বমোট (ক্যাশ অন ডেলিভারি)
            </td>
            <td className="px-3 py-1.5 text-right text-base font-bold text-ink">
              ৳{toBn(order.totalPrice)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="px-3 py-1 text-center text-[11px] text-muted-foreground">
        পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন • ধন্যবাদ! 🧸
      </div>
    </div>
  );
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; per?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  const per = sp.per === "6" ? 6 : sp.per === "4" ? 4 : 2;
  if (ids.length === 0) {
    redirect("/admin");
  }

  const [orders, deliveryConfig, productConfig] = await Promise.all([
    db.order.findMany({ where: { id: { in: ids } } }),
    getDeliveryConfig(),
    getProductConfig(),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const list = ids
    .map((id) => byId.get(id))
    .filter((o): o is Order => !!o);
  if (list.length === 0) {
    redirect("/admin");
  }
  const zoneName = (id: string) =>
    deliveryConfig.zones.find((z) => z.id === id)?.label ?? "";
  const zoneNote = (id: string) =>
    deliveryConfig.zones.find((z) => z.id === id)?.note ?? "";

  const idsParam = encodeURIComponent(ids.join(","));

  return (
    <main className="min-h-screen bg-neutral-200 p-4">
      <style>{`
        @page { size: A4; margin: 10mm 8mm; }
        @media print {
          .no-print { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          .print-grid { display: block !important; max-width: none !important; }
          .invoice { border-radius: 0 !important; break-inside: avoid-page; page-break-inside: avoid; }
          .invoice-2up { height: 135mm; overflow: hidden; margin: 0 0 3mm 0 !important; }
          .invoice-2up:nth-of-type(2n) { break-after: page; page-break-after: always; margin-bottom: 0 !important; }
          .invoice-4up { height: 66mm; overflow: hidden; margin: 0 0 3mm 0 !important; }
          .invoice-4up:nth-of-type(4n) { break-after: page; page-break-after: always; margin-bottom: 0 !important; }
          .invoice-6up { height: 88mm; overflow: hidden; margin: 0 0 3mm 0 !important; }
          .invoice-6up:nth-of-type(6n) { break-after: page; page-break-after: always; margin-bottom: 0 !important; }
        }
        .invoice-2up { min-height: 120mm; }
        .invoice-4up { min-height: 0; }
        .invoice-6up { min-height: 0; }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow">
        <div className="text-sm font-bold text-ink">
          🖨️ {toBn(list.length)}টি ইনভয়েস — A4 পেজে {toBn(per)}টা করে
          <Link href="/admin" className="ml-3 font-semibold text-brand hover:underline">
            ← অ্যাডমিনে ফিরুন
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/print?ids=${idsParam}&per=2`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${per === 2 ? "bg-ink text-white" : "border border-border text-ink"}`}
          >
            পেজে ২টা
          </Link>
          <Link
            href={`/admin/print?ids=${idsParam}&per=4`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${per === 4 ? "bg-ink text-white" : "border border-border text-ink"}`}
          >
            পেজে ৪টা
          </Link>
          <Link
            href={`/admin/print?ids=${idsParam}&per=6`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${per === 6 ? "bg-ink text-white" : "border border-border text-ink"}`}
          >
            পেজে ৬টা
          </Link>
          <PrintButton />
        </div>
      </div>

      <div
        className={`print-grid mx-auto grid max-w-4xl gap-4 ${per === 2 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}
      >
        {list.map((o) => (
          <div key={o.id} className={per === 6 ? "invoice-6up" : per === 4 ? "invoice-4up" : "invoice-2up"}>
            <Invoice order={o} zoneLabel={zoneName(o.deliveryZone)} zoneNote={zoneNote(o.deliveryZone)} compact={per !== 2} sku={skuLabelForMixed(productConfig, o.quantity, colorIds(o), o.items)} productConfig={productConfig} />
          </div>
        ))}
      </div>
    </main>
  );
}
