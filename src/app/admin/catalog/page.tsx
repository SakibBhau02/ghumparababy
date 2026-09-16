import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { listCatalogItems } from "@/lib/catalog";
import { CatalogManager } from "@/components/admin/catalog-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "প্রোডাক্ট ক্যাটালগ — অ্যাডমিন প্যানেল | ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function AdminCatalogPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const initialItems = await listCatalogItems({ onlyActive: false });

  return <CatalogManager initialItems={initialItems} />;
}