"use client";

import {
  type CourierId,
  type FraudCheckResult,
  type CourierFraudResult,
  COURIER_META,
  PATHAO_RATING_LABEL,
  RISK_META,
  riskLevel,
} from "@/lib/fraud-shared";
import { toBn } from "@/lib/landing-data";
import { ShieldCheck } from "lucide-react";

/**
 * Compact fraud result badge — used in order rows and customer headers.
 */
export function FraudBadge({
  result,
  compact = false,
}: {
  result: FraudCheckResult;
  compact?: boolean;
}) {
  const risk = riskLevel(result.aggregated.successRatio, result.aggregated.total);
  const meta = RISK_META[risk];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${meta.badge}`}
      >
        {meta.emoji} {risk === "none" ? "— ডেটা নেই" : `${toBn(result.aggregated.successRatio)}%`}
      </span>
    );
  }

  return <FraudResultDetails result={result} />;
}

function courierLine(id: string, c: CourierFraudResult): string | null {
  const signals: string[] = [];
  if (c.customerRating) {
    signals.push(PATHAO_RATING_LABEL[c.customerRating] ?? c.customerRating);
  }
  if (!c.countsAvailable && c.customerRating) return signals.join(" • ") || null;
  if (c.total > 0) {
    signals.unshift(`${c.delivered}✅ / ${c.cancelled}❌`);
  }
  if (c.customerSegment) signals.push(c.customerSegment);
  if (c.label) signals.push(c.label);
  if (typeof c.fraudCount === "number" && c.fraudCount > 0) {
    signals.push(`${c.fraudCount}টি অভিযোগ`);
  }
  if (typeof c.fraudReportCount === "number" && c.fraudReportCount > 0) {
    signals.push(`${c.fraudReportCount}টি রিপোর্ট`);
  }
  return signals.length > 0 ? signals.join(" • ") : null;
}

/**
 * Full fraud result view — overall summary + per-courier cards with each
 * courier's native fraud signals (complaints / rating / segment / label).
 * Shared by the manual-check tab and the customer profile page.
 */
export function FraudResultDetails({
  result,
  errors,
  sources,
}: {
  result: FraudCheckResult;
  errors?: FraudCheckResult["errors"];
  sources?: FraudCheckResult["sources"];
}) {
  const risk = riskLevel(result.aggregated.successRatio, result.aggregated.total);
  const meta = RISK_META[risk];
  const errs = errors ?? result.errors ?? {};
  const srcs = sources ?? result.sources ?? {};
  const steadfast = result.couriers.steadfast;
  const showFrauds = (steadfast?.frauds?.length ?? 0) > 0;

  return (
    <div className="space-y-2">
      {/* Overall */}
      <div className={`flex items-center gap-2 rounded-xl border p-3 ${meta.badge}`}>
        <span className="text-lg">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">
            {meta.label} — মোট {toBn(result.aggregated.total)}টি অর্ডার
          </div>
          <div className="text-xs opacity-80">
            {toBn(result.aggregated.delivered)} ডেলিভারড / {toBn(result.aggregated.cancelled)} বাতিল
            {result.aggregated.total > 0 && (
              <> — {toBn(result.aggregated.successRatio)}% সফলতা</>
            )}
          </div>
        </div>
      </div>

      {/* Per-courier */}
      {Object.entries(result.couriers).map(([id, c]) => {
        const cr = c as CourierFraudResult;
        const cm = COURIER_META[id as keyof typeof COURIER_META];
        if (!cm) return null;
        const line = courierLine(id, cr);
        const src = srcs[id as CourierId];
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-cream/40 px-3 py-2 text-sm"
          >
            <span className="flex shrink-0 items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${cm.color}`}>
                {cm.label}
              </span>
              {src === "fraudbd" && (
                <span
                  title="Merchant login নয় — FraudBD API থেকে আনা"
                  className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
                >
                  FraudBD
                </span>
              )}
            </span>
            <span className="text-right font-bold text-ink">
              {line ?? <span className="text-muted-foreground">—</span>}
            </span>
          </div>
        );
      })}

      {/* Failed couriers */}
      {Object.entries(errs).map(([id, msg]) => {
        if (result.couriers[id as CourierId] || !msg) return null;
        const cm = COURIER_META[id as keyof typeof COURIER_META];
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-white px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="font-bold">{cm?.label ?? id}</span>
            <span>{msg}</span>
          </div>
        );
      })}

      {/* Steadfast complaint details (who reported what) */}
      {showFrauds && (
        <details className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-bold text-red-700">
            🚨 Steadfast-এ {toBn(steadfast!.fraudReportCount ?? steadfast!.frauds!.length)}টি অভিযোগ — বিস্তারিত দেখুন
          </summary>
          <ul className="mt-2 space-y-2">
            {steadfast!.frauds!.map((f, i) => (
              <li key={i} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-xs text-ink">
                {f.details && <p className="font-semibold">“{f.details}”</p>}
                <p className="mt-1 text-muted-foreground">
                  {[f.name, f.phone ? `(${f.phone})` : null].filter(Boolean).join(" ")}
                  {f.createdAt ? ` • ${new Date(f.createdAt).toLocaleDateString("bn-BD")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Inline fraud check button — fetches and shows result on click.
 */
export function FraudCheckButton({ phone }: { phone: string }) {
  const handleCheck = async () => {
    window.open(`/admin/customer/${phone}#fraud`, "_blank");
  };

  return (
    <button
      onClick={handleCheck}
      className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
    >
      <ShieldCheck className="size-3" />
      fraud check
    </button>
  );
}
