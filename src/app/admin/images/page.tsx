import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { getSiteImages } from "@/lib/site-config";
import { ImagesManager } from "@/components/admin/images-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ওয়েবসাইটের ছবি — অ্যাডমিন প্যানেল | ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function AdminImagesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const siteImages = await getSiteImages();

  return <ImagesManager initialConfig={siteImages} />;
}