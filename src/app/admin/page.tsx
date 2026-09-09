import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getDeliveryConfig } from "@/lib/delivery";
import { getProductConfig } from "@/lib/product";
import { getLocationEnabled } from "@/lib/site-settings";
import { getWhatsappConfig } from "@/lib/whatsapp";
import { AdminDashboard } from "@/components/admin/dashboard";
import type { Order } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "অ্যাডমিন প্যানেল — ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  try {
    const [orders, deliveryConfig, productConfig, locationEnabled, whatsapp, customers] =
      await Promise.all([
        db.order.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] }),
        getDeliveryConfig(),
        getProductConfig(),
        getLocationEnabled(),
        getWhatsappConfig(),
        db.customer.findMany({ orderBy: { lastOrderAt: "desc" } }),
      ]);

    return (
      <AdminDashboard
        initialOrders={orders}
        deliveryConfig={deliveryConfig}
        productConfig={productConfig}
        locationEnabled={locationEnabled}
        whatsapp={whatsapp}
        customers={customers}
      />
    );
  } catch {
    return <DbErrorCard />;
  }
}

/**
 * Database unreachable (e.g. DATABASE_URL missing on Vercel) —
 * show an actionable Bengali message instead of a cryptic error digest.
 */
function DbErrorCard() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream/60 px-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-white p-8 text-center shadow-xl">
        <div className="text-5xl">🗄️</div>
        <h1 className="mt-4 text-2xl font-bold text-ink">ডাটাবেজে সংযোগ করা যাচ্ছে না</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          অর্ডার তালিকা লোড করতে ডাটাবেজ দরকার। নিচের ধাপগুলো অনুসরণ করুন:
        </p>
        <ol className="mt-4 space-y-2 rounded-2xl bg-cream p-4 text-left text-sm text-ink">
          <li>
            <b>১.</b> Vercel → Project → <b>Settings → Environment Variables</b> খুলুন
          </li>
          <li>
            <b>২.</b> <b>DATABASE_URL</b> (pooled) ও <b>DIRECT_URL</b> বসান — Production + Preview দুটোতেই টিক দিন
          </li>
          <li>
            <b>৩.</b> Deployments থেকে <b>Redeploy</b> করুন
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          ওয়েবসাইটের অর্ডার ফর্ম এতে বন্ধ হবে না — শুধু অ্যাডমিনের তালিকা দেখা যাবে না।
        </p>
      </div>
    </main>
  );
}
