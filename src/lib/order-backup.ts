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

export type BackupOrder = {
  id: string;
  orderCode: string;
  name: string;
  phone: string;
  address: string;
  color: string;
  packageName: string;
  quantity: number;
  unitPrice: number;
  deliveryZone: string;
  deliveryCharge: number;
  totalPrice: number;
  status: string;
  createdAt: string | Date;
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
  "color",
  "packageName",
  "quantity",
  "unitPrice",
  "deliveryZone",
  "deliveryCharge",
  "totalPrice",
  "status",
  "createdAt",
  "id",
] as const;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Guard against CSV formula injection in spreadsheet apps
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function ordersToCsv(orders: BackupOrder[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const o of orders) {
    lines.push(
      [
        o.orderCode,
        o.name,
        o.phone,
        o.address,
        o.color,
        o.packageName,
        o.quantity,
        o.unitPrice,
        o.deliveryZone,
        o.deliveryCharge,
        o.totalPrice,
        o.status,
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
 * Sorted newest first. Never throws.
 */
export async function mergedOrders(): Promise<BackupOrder[]> {
  let dbRows: BackupOrder[] = [];
  try {
    dbRows = (await db.order.findMany({ orderBy: { createdAt: "desc" } })) as BackupOrder[];
  } catch (e) {
    console.error("order-backup: DB read failed", e);
  }
  const ledger = await readBackupRows();
  const seen = new Set(dbRows.map((r) => r.id));
  const extras = ledger.filter((r) => !r.id || !seen.has(r.id));
  return [...dbRows, ...extras].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
}

/** Rewrite both CSV copies from the merged view. Never throws. */
export async function writeBackups(): Promise<void> {
  try {
    const orders = await mergedOrders();
    const csv = ordersToCsv(orders);
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
export async function appendOrderBackup(order: BackupOrder): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const line = JSON.stringify(order);
    await fs.appendFile(JSONL_PATH, line + "\n", "utf8");
    await writeBackups();
  } catch (e) {
    console.error("order-backup: append failed", e);
  }
}
