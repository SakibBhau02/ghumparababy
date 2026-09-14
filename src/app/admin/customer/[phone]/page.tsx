import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-auth";
import { CustomerDetail } from "@/components/admin/customer-detail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "কাস্টমার প্রোফাইল — ঘুমপাড়া বেবি",
  robots: { index: false, follow: false },
};

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) {
    redirect("/admin/login");
  }

  const { phone } = await params;
  // Phone comes URL-encoded from the path (digits only — decode for safety).
  const decoded = decodeURIComponent(phone);

  try {
    const customer = await db.customer.findUnique({
      where: { phone: decoded },
    });
    if (!customer) {
      return (
        <main className="grid min-h-screen place-items-center bg-cream/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-white p-8 text-center shadow-xl">
            <div className="text-5xl">🔍</div>
            <h1 className="mt-4 text-xl font-bold text-ink">কাস্টমার পাওয়া যায়নি</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              এই নম্বরে কোনো কাস্টমার প্রোফাইল নেই ({decoded})।
            </p>
            <Link
              href="/admin"
              className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-deep"
            >
              অ্যাডমিন প্যানেলে ফিরুন
            </Link>
          </div>
        </main>
      );
    }

    const orders = await db.order.findMany({
      where: { phone: decoded },
      orderBy: { createdAt: "desc" },
    });

    return <CustomerDetail customer={customer} orders={orders} />;
  } catch {
    return (
      <main className="grid min-h-screen place-items-center bg-cream/60 px-4">
        <div className="rounded-[2rem] border border-border bg-white p-8 text-center shadow-xl">
          <div className="text-5xl">🗄️</div>
          <h1 className="mt-4 text-xl font-bold text-ink">ডাটাবেজে সংযোগ করা যাচ্ছে না</h1>
          <p className="mt-2 text-sm text-muted-foreground">কিছুক্ষণ পর আবার চেষ্টা করুন।</p>
        </div>
      </main>
    );
  }
}
