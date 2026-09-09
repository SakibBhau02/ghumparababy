import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getDeliveryConfig } from "@/lib/delivery";
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

  const [orders, deliveryConfig] = await Promise.all([
    db.order.findMany({ orderBy: { createdAt: "desc" } }),
    getDeliveryConfig(),
  ]);

  return <AdminDashboard initialOrders={orders} deliveryConfig={deliveryConfig} />;
}
