import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { mergedOrders, ordersToCsv } from "@/lib/order-backup";

/**
 * GET /api/admin/orders/export — download every order as CSV.
 * Includes DB rows + backup-ledger rows missing from the DB,
 * so data survives accidental deletion or a DB reset.
 * Admin session required.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return new Response(JSON.stringify({ error: "অনুমতি নেই।" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const orders = await mergedOrders();
  const csv = ordersToCsv(orders);

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  // \uFEFF BOM so Excel opens Bangla text correctly
  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ghumpara-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
