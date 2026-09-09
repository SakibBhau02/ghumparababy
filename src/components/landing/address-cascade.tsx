"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import type { BdDivision, LocationSelection } from "@/lib/bd-geo";

const selectCls =
  "mt-1.5 h-12 w-full rounded-xl border border-input bg-cream/60 px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50";

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <option value="" disabled>
      {children}
    </option>
  );
}

/**
 * Cascading Division → District → Upazila selector.
 * Dataset (/data/bd-geo.json) loads lazily so the landing bundle stays small.
 */
export function AddressCascade({
  value,
  onChange,
}: {
  value: LocationSelection;
  onChange: (v: LocationSelection) => void;
}) {
  const [divisions, setDivisions] = useState<BdDivision[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/data/bd-geo.json", { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (alive) setDivisions(d as BdDivision[]);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const division = divisions?.find((d) => d.bn === value.division);
  const district = division?.districts.find((d) => d.bn === value.district);

  return (
    <div>
      <Label className="text-base font-bold text-ink">৪. আপনার এলাকা নির্বাচন করুন</Label>
      {failed ? (
        <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          এলাকার তালিকা লোড হয়নি। ইন্টারনেট চেক করে পেজ রিফ্রেশ করুন।
        </p>
      ) : (
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="division" className="text-sm text-muted-foreground">
              বিভাগ *
            </Label>
            <select
              id="division"
              required
              value={value.division}
              disabled={!divisions}
              onChange={(e) =>
                onChange({ division: e.target.value, district: "", upazila: "" })
              }
              className={selectCls}
            >
              <Placeholder>{divisions ? "বিভাগ বেছে নিন" : "লোড হচ্ছে..."}</Placeholder>
              {divisions?.map((d) => (
                <option key={d.id} value={d.bn}>
                  {d.bn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="district" className="text-sm text-muted-foreground">
              জেলা *
            </Label>
            <select
              id="district"
              required
              value={value.district}
              disabled={!division}
              onChange={(e) =>
                onChange({ ...value, district: e.target.value, upazila: "" })
              }
              className={selectCls}
            >
              <Placeholder>জেলা বেছে নিন</Placeholder>
              {division?.districts.map((d) => (
                <option key={d.id} value={d.bn}>
                  {d.bn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="upazila" className="text-sm text-muted-foreground">
              উপজেলা / থানা *
            </Label>
            <select
              id="upazila"
              required
              value={value.upazila}
              disabled={!district}
              onChange={(e) => onChange({ ...value, upazila: e.target.value })}
              className={selectCls}
            >
              <Placeholder>উপজেলা বেছে নিন</Placeholder>
              {district?.upazilas.map((u) => (
                <option key={u.id} value={u.bn}>
                  {u.bn}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        সঠিক উপজেলা দিলে কুরিয়ার ডেলিভারি দ্রুত ও নির্ভুল হবে।
      </p>
    </div>
  );
}
