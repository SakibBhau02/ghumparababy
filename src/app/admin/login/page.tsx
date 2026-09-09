"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "লগইন ব্যর্থ হয়েছে।");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-cream via-brand-soft/50 to-cream px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-[2rem] border border-border bg-white p-8 shadow-2xl shadow-brand/10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-soft">
            <LockKeyhole className="size-8 text-brand" />
          </div>
          <h1 className="mt-4 text-center text-2xl font-bold text-ink">
            অ্যাডমিন প্যানেল
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            ঘুমপাড়া বেবি — অর্ডার ম্যানেজমেন্ট
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="username">ইউজারনেম</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="আপনার ইউজারনেম"
                autoComplete="username"
                required
                className="mt-1.5 h-12 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="password">পাসওয়ার্ড</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="আপনার পাসওয়ার্ড"
                autoComplete="current-password"
                required
                className="mt-1.5 h-12 rounded-xl"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> চেক করা হচ্ছে...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 size-4" /> লগইন করুন
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> নিরাপদ সেশন — ৭ দিন পর্যন্ত সাইন-ইন থাকবে
        </p>
      </div>
    </main>
  );
}
