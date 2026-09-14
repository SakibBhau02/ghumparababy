import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getGtmConfig } from "@/lib/gtm-config";
import { GtmSetup } from "@/components/admin/gtm-setup";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GTM সেটআপ — অ্যাডমিন প্যানেল | ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function AdminGtmPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const gtmConfig = await getGtmConfig();

  return <GtmSetup initialConfig={gtmConfig} />;
}
