import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getPixelConfig } from "@/lib/pixel-config";
import { PixelSetup } from "@/components/admin/pixel-setup";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meta Pixel সেটআপ — অ্যাডমিন প্যানেল | ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function AdminPixelPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const pixelConfig = await getPixelConfig();

  return <PixelSetup initialConfig={pixelConfig} />;
}
