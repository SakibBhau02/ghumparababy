/**
 * Order backup system — protects order data from being lost.
 *
 * Every successful order is appended to an append-only JSONL ledger
 * (db/backups/orders.jsonl) and CSV copies are refreshed:
 *   - db/backups/orders-backup.csv   (durable backup copy)
 *   - download/orders-latest.csv     (user-facing always-fresh copy)
 *
 * Export/merge logic: DB rows + "backup-only" rows (orders that existed in
 * the ledger but are missing from the DB — e.g. after a DB reset) are merged
 * so nothing is ever silently dropped from an export.
 */

import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { PRODUCT_COLORS } from "@/lib/landing-data";

export type BackupOrder = {
  id: string;
  orderCode: string;
  name: string;
  phone: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  color: string;
  colors: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  deliveryZone: string;
  deliveryCharge: number;
  totalPrice: number;
  status: string;
  pinned: boolean;
  waSent: boolean;
  createdAt: string | Date;
  /** Mixed-cart line items JSON (absent on pre-items ledger rows). */
  items?: string;
};

const BACKUP_DIR = path.join(process.cwd(), "db", "backups");
const JSONL_PATH = path.join(BACKUP_DIR, "orders.jsonl");
const BACKUP_CSV = path.join(BACKUP_DIR, "orders-backup.csv");
const LATEST_CSV = path.join(process.cwd(), "download", "orders-latest.csv");

export const CSV_HEADERS = [
  "orderCode",
  "name",
  "phone",
  "address",
  "division",
  "district",
  "upazila",
  "color",
  "colors",
  "packageName",
  "sku",
  "quantity",
  "unitPrice",
  "deliveryZone",
  "deliveryCharge",
  "totalPrice",
  "status",
  "pinned",
  "createdAt",
  "id",
] as const;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Guard against CSV formula injection in spreadsheet apps
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** JSON color-id array → joined Bangla labels (for CSV export). */
export function colorLabels(raw: unknown): string {  try {
    const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!Array.isArray(arr)) return "";
    return arr
      .filter((c): c is string => typeof c === "string")
      .map((c) => PRODUCT_COLORS.find((p) => p.id === c)?.label ?? c)
      .join(", ");
  } catch {
    return "";
  }
}

/** JSON color-id array → color id list (legacy single-color field-এ fallback)। */
export function orderColorIds(o: { colors: string; color: string }): string[] {
  try {
    const arr = JSON.parse(o.colors) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter((c): c is string => typeof c === "string");
    }
  } catch {
    // fall through to legacy color
  }
  return [o.color];
}

export function ordersToCsv(
  orders: BackupOrder[],
  /** Optional SKU resolver (live product config থেকে) — না দিলে sku কলাম খালি থাকবে। */
  getSku?: (o: BackupOrder) => string
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const o of orders) {
    let sku = "";
    try {
      sku = getSku ? getSku(o) : "";
    } catch {
      sku = "";
    }
    lines.push(
      [
        o.orderCode,
        o.name,
        o.phone,
        o.address,
        o.division ?? "",
        o.district ?? "",
        o.upazila ?? "",
        o.color,
        colorLabels(o.colors),
        o.packageName,
        sku,
        o.quantity,
        o.unitPrice,
        o.deliveryZone,
        o.deliveryCharge,
        o.totalPrice,
        o.status,
        o.pinned ? "yes" : "",
        o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
        o.id,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

async function readBackupRows(): Promise<BackupOrder[]> {
  try {
    const raw = await fs.readFile(JSONL_PATH, "utf8");
    const rows: BackupOrder[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        rows.push(JSON.parse(t) as BackupOrder);
      } catch {
        // skip corrupt line — ledger stays append-only
      }
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * All orders = DB rows + ledger rows missing from the DB (deleted/reset).
 * Pinned first, then newest first. Never throws.
 */
export async function mergedOrders(): Promise<BackupOrder[]> {
  let dbRows: BackupOrder[] = [];
  try {
    dbRows = (await db.order.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    })) as BackupOrder[];
  } catch (e) {
    console.error("order-backup: DB read failed", e);
  }
  const ledger = await readBackupRows();
  const deleted = await getDeletedIds();
  const seen = new Set(dbRows.map((r) => r.id));
  const extras = ledger.filter(
    (r) => (!r.id || !seen.has(r.id)) && (!r.id || !deleted.has(r.id))
  );
  return [...dbRows, ...extras].sort((a, b) => {
    const pin = Number(b.pinned ?? false) - Number(a.pinned ?? false);
    if (pin !== 0) return pin;
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
}

const DELETED_KEY = "deleted_order_ids";

/** IDs the admin deleted — hidden from list/export, ledger keeps them as audit. */
export async function getDeletedIds(): Promise<Set<string>> {
  try {
    const row = await db.setting.findUnique({ where: { key: DELETED_KEY } });
    if (!row) return new Set();
    const arr = JSON.parse(row.value) as unknown;
    return new Set(
      Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []
    );
  } catch {
    return new Set();
  }
}

/** Remember a deleted order id (never throws). */
export async function addDeletedId(id: string): Promise<void> {
  try {
    const ids = await getDeletedIds();
    ids.add(id);
    const value = JSON.stringify([...ids]);
    await db.setting.upsert({
      where: { key: DELETED_KEY },
      update: { value },
      create: { key: DELETED_KEY, value },
    });
  } catch (e) {
    console.error("order-backup: tombstone failed", e);
  }
}

/** Rewrite both CSV copies from the merged view. Never throws. */
export async function writeBackups(
  getSku?: (o: BackupOrder) => string
): Promise<void> {  try {
    const orders = await mergedOrders();
    const csv = ordersToCsv(orders, getSku);
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.writeFile(BACKUP_CSV, csv, "utf8");
    await fs.writeFile(LATEST_CSV, csv, "utf8");
  } catch (e) {
    console.error("order-backup: CSV write failed", e);
  }
}

/**
 * Append one order to the JSONL ledger, then refresh CSV copies.
 * Designed to be called right after a successful order creation.
 * Never throws — order creation must not fail because of backup.
 */
export async function appendOrderBackup(
  order: BackupOrder,
  getSku?: (o: BackupOrder) => string
): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const line = JSON.stringify(order);
    await fs.appendFile(JSONL_PATH, line + "\n", "utf8");
    await writeBackups(getSku);
  } catch (e) {
    console.error("order-backup: append failed", e);
  }
}
