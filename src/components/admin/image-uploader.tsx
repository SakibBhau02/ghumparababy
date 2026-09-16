"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";

/**
 * Reusable admin image uploader: pick an image → /api/admin/upload
 * (sharp-optimized, R2) → setUrl. Shows a live preview + clear button.
 */
export function ImageUploader({
  url,
  onUrl,
  aspectClass = "aspect-square",
}: {
  url: string;
  onUrl: (url: string) => void;
  aspectClass?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "আপলোড ব্যর্থ হয়েছে।");
      }
      onUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে।");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="relative">
        <div
          className={`relative w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-cream/40 ${aspectClass}`}
        >
          {url ? (
            <Image
              src={url}
              alt="ছবি প্রিভিউ"
              fill
              className="object-cover"
              sizes="200px"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
              এখনো ছবি নেই — নিচের বাটনে আপলোড করুন
            </div>
          )}
          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-full font-semibold"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" /> আপলোড হচ্ছে…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 size-4" /> ছবি আপলোড
              </>
            )}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUrl("")}
              className="rounded-full text-xs text-destructive"
            >
              <X className="mr-1 size-3.5" /> মুছুন
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}