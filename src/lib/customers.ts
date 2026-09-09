import { db } from "@/lib/db";

/**
 * Recompute a customer profile from their remaining orders.
 * Called after admin edits/deletes (best-effort — never throws).
 * Removes the profile when no orders remain.
 */
export async function recomputeCustomer(phone: string): Promise<void> {
  try {
    const orders = await db.order.findMany({
      where: { phone },
      orderBy: { createdAt: "asc" },
    });
    if (orders.length === 0) {
      await db.customer.delete({ where: { phone } }).catch(() => {});
      return;
    }
    const first = orders[0];
    const last = orders[orders.length - 1];
    const data = {
      name: last.name,
      address: last.address,
      division: last.division,
      district: last.district,
      upazila: last.upazila,
      orderCount: orders.length,
      totalSpent: orders.reduce((s, o) => s + o.totalPrice, 0),
      firstOrderAt: first.createdAt,
      lastOrderAt: last.createdAt,
    };
    await db.customer.upsert({
      where: { phone },
      update: data,
      create: { phone, ...data },
    });
  } catch (e) {
    console.error("recomputeCustomer failed:", e);
  }
}
