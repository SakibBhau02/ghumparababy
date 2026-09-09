"use client";

import { useEffect, useState } from "react";

function getTimeLeft() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end.getTime() - now.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds };
}

const bn = (n: number) => String(n).padStart(2, "0").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export function Countdown({ compact = false }: { compact?: boolean }) {
  const [time, setTime] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const update = () => setTime(getTimeLeft());
    const raf = requestAnimationFrame(update);
    const timer = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  const box = compact
    ? "min-w-9 rounded-lg bg-white/15 px-2 py-1 text-center"
    : "min-w-14 rounded-xl bg-white/15 px-3 py-2 text-center";

  return (
    <div className="flex items-center gap-1.5" aria-label="অফার শেষ হওয়ার সময়">
      {[
        { label: "ঘণ্টা", value: time?.hours },
        { label: "মিনিট", value: time?.minutes },
        { label: "সেকেন্ড", value: time?.seconds },
      ].map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={box}>
            <div className={`font-bold tabular-nums text-white ${compact ? "text-base" : "text-2xl"}`}>
              {time ? bn(item.value as number) : "--"}
            </div>
            {!compact && <div className="text-[10px] text-white/70">{item.label}</div>}
          </div>
          {i < 2 && <span className="font-bold text-white/70">:</span>}
        </div>
      ))}
    </div>
  );
}
