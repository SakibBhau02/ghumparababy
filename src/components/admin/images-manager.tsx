"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  SITE_IMAGE_SLOTS,
  SITE_IMAGE_SLOT_LABELS,
  sanitizeSiteImagesConfig,
  type SiteImagesConfig,
} from "@/lib/site-images-config";
import { ImageUploader } from "@/components/admin/image-uploader";
import { ImageIcon, Loader2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";

/**
 * Admin: ওয়েবসাইটের সব সেকশনের ছবি এক জায়গা থেকে বদলান।
 * আপলোড লাগলে automatically sharp-optimize হয়ে R2-তে যাবে এবং
 * ল্যান্ডিং পেজ/শেয়ার-ছবি/ফ্যাভিকন সাথে সাথে update হবে।
 */
export function ImagesManager({ initialConfig }: { initialConfig: SiteImagesConfig }) {
  const router = useRouter();
  const { toast } = useToast();
  const [config, setConfig] = useState<SiteImagesConfig>(initialConfig);
  const [busy, setBusy] = useState(false);

  const dirty =
    JSON.stringify(config) !== JSON.stringify(initialConfig);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/images", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি।");
      setConfig(sanitizeSiteImagesConfig(data.config));
      toast({
        title: "✓ ছবি সেভ হয়েছে",
        description: "ল্যান্ডিং পেজ রিলোড করলে নতুন ছবি দেখা যাবে (১ মিনিটের মধ্যে)।",
      });
    } catch (e) {
      toast({
        title: "সেভ হয়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream/60 pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-bold text-ink">
                <ImageIcon className="mr-1.5 inline size-5 text-brand" />
                ওয়েবসাইটের ছবি
              </h1>
              <p className="text-xs text-muted-foreground">
                আপলোড করলেই ছবি অটো-কমপ্রেস হয়ে R2-তে সেভ হয়
              </p>
            </div>
          </div>
          <Button
            onClick={save}
            disabled={busy || !dirty}
            className="rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            সেভ করুন
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 pt-6">
        <div className="rounded-2xl border border-leaf/40 bg-leaf/5 p-4 text-sm leading-relaxed text-ink">
          নিচের প্রতিটি ছবি <b>ল্যান্ডিং পেজের নির্দিষ্ট সেকশনে</b> দেখায়।
          যেকোনো স্লটে নতুন ছবি আপলোড দিলে সাথে সাথে (পেজ রিলোডে) বদলে যায়।
          আরও ভালো মানের ছবি = বেশি বিশ্বাস = বেশি অর্ডার।
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {SITE_IMAGE_SLOTS.map((slot) => (
            <section
              key={slot}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <Label className="text-base font-bold text-ink">
                {SITE_IMAGE_SLOT_LABELS[slot]}
              </Label>
              <div className="mt-3">
                <ImageUploader
                  url={config[slot]}
                  onUrl={(url) => setConfig((c) => ({ ...c, [slot]: url }))}
                  aspectClass={slot === "howToUse" || slot === "hero" ? "aspect-[4/3]" : "aspect-square"}
                />
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-white/70 p-4">
          <p className="text-sm text-muted-foreground">
            কনফিগ পুরনো ছবিতে ফেরত নিতে চাইলে নিচের বাটনে চাপুন (সংরক্ষিত থাকবে না)।
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setConfig(sanitizeSiteImagesConfig({}))}
          >
            <RotateCcw className="mr-1.5 size-4" /> ডিফল্টে ফেরত
          </Button>
        </div>
      </div>
    </main>
  );
}