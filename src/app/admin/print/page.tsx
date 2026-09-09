import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { PRODUCT_COLORS, toBn, HOTLINE } from "@/lib/landing-data";
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

function colorLabel(id: string): string {
  return PRODUCT_COLORS.find((c) => c.id === id)?.label ?? id;
}

function productImage(order: Order): string {
  const first = colorIds(order)[0] ?? order.color;
  return PRODUCT_COLORS.find((c) => c.id === first)?.image ?? "/images/swaddle-pink.jpg";
}

function locationLine(order: Order): string {
  return [order.division, order.district, order.upazila].filter(Boolean).join(", ");
}

function Invoice({ order }: { order: Order }) {
  const colors = colorIds(order);
  const loc = locationLine(order);
  return (
    <div className="invoice overflow-hidden rounded-xl border-2 border-ink bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
        <div>
          <div className="text-lg font-bold text-ink">🧸 ঘুমপাড়া বেবি</div>
          <div className="text-xs text-muted-foreground">হটলাইন: {HOTLINE} (সকাল ৯টা — রাত ১০টা)</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-ink">{order.orderCode}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("bn-BD", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            • {STATUS_BN[order.status] ?? order.status}
          </div>
        </div>
      </div>
      {/* Customer */}
      <div className="grid grid-cols-2 gap-2 px-4 py-2 text-xs">
        <div>
          <div className="font-bold text-ink">{order.name}</div>
          <div className="font-semibold">📞 {order.phone}</div>
        </div>
        <div className="text-right text-muted-foreground">
          <div>{order.address}</div>
          {loc && <div>{loc}</div>}
        </div>
      </div>
      {/* Items */}
      <table className="w-full border-t-2 border-ink text-xs">
        <thead>
          <tr className="bg-cream text-left text-muted-foreground">
            <th className="px-4 py-1 font-semibold">পণ্য</th>
            <th className="px-2 py-1 text-center font-semibold">পরিমাণ</th>
            <th className="px-2 py-1 text-right font-semibold">দর</th>
            <th className="px-4 py-1 text-right font-semibold">মোট</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="px-4 py-1.5">
              <div className="flex items-center gap-2">
                <span className="relative block size-10 shrink-0 overflow-hidden rounded-md border border-border">
                  <Image
                    src={productImage(order)}
                    alt="সোয়াডেল"
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </span>
                <span>
                  <span className="font-bold text-ink">{order.packageName}</span>
                  <span className="block text-muted-foreground">
                    কালার: {colors.map(colorLabel).join(", ")}
                  </span>
                </span>
              </div>
            </td>
            <td className="px-2 py-1.5 text-center font-semibold">{toBn(order.quantity)}টি</td>
            <td className="px-2 py-1.5 text-right">৳{toBn(order.unitPrice)}</td>
            <td className="px-4 py-1.5 text-right font-bold">
              ৳{toBn(order.unitPrice * order.quantity)}
            </td>
          </tr>
          <tr className="border-t border-border">
            <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground">
              ডেলিভারি চার্জ
            </td>
            <td className="px-4 py-1 text-right font-semibold">
              {order.deliveryCharge > 0 ? `৳${toBn(order.deliveryCharge)}` : "ফ্রি"}
            </td>
          </tr>
          <tr className="border-t-2 border-ink bg-cream">
            <td colSpan={3} className="px-4 py-1.5 text-right font-bold text-ink">
              সর্বমোট (ক্যাশ অন ডেলিভারি)
            </td>
            <td className="px-4 py-1.5 text-right text-base font-bold text-ink">
              ৳{toBn(order.totalPrice)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="px-4 py-1.5 text-center text-[11px] text-muted-foreground">
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
  const per = sp.per === "4" ? 4 : 2;
  if (ids.length === 0) {
    redirect("/admin");
  }

  const orders = await db.order.findMany({ where: { id: { in: ids } } });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const list = ids
    .map((id) => byId.get(id))
    .filter((o): o is Order => !!o);
  if (list.length === 0) {
    redirect("/admin");
  }

  const idsParam = encodeURIComponent(ids.join(","));

  return (
    <main className="min-h-screen bg-neutral-200 p-4">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          .invoice { border-radius: 0 !important; break-inside: avoid; }
        }
        .invoice-2up { min-height: 130mm; }
        @media print { .invoice-2up { height: 130mm; } }
        .invoice-4up { min-height: 0; }
        @media print { .invoice-4up { height: 63mm; overflow: hidden; } }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow">
        <div className="text-sm font-bold text-ink">
          🖨️ {toBn(list.length)}টি ইনভয়েস
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
          <PrintButton />
        </div>
      </div>

      <div
        className={`mx-auto grid max-w-4xl gap-4 ${per === 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
      >
        {list.map((o) => (
          <div key={o.id} className={per === 4 ? "invoice-4up" : "invoice-2up"}>
            <Invoice order={o} />
          </div>
        ))}
      </div>
    </main>
  );
}
