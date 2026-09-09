/**
 * Pure (client-safe) WhatsApp auto-message config — NO server imports here.
 * Server-side read/write + sending live in src/lib/whatsapp.ts.
 *
 * Provider: Meta WhatsApp Cloud API (official). Admin pastes credentials
 * from the Meta developer dashboard; message goes out automatically when an
 * order is marked "confirmed" in the admin panel.
 *
 * Template slots (Meta template {{1}}..{{5}}, fixed order):
 *   {{1}} = customer name      {{2}} = order code      {{3}} = package
 *   {{4}} = quantity (pcs)     {{5}} = total price (BDT)
 * The admin's templateBody text is documentation of the approved template —
 * keep it identical to the template approved in Meta.
 */

export type WhatsappConfig = {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  templateName: string;
  languageCode: string;
  templateBody: string;
};

export const DEFAULT_WHATSAPP_CONFIG: WhatsappConfig = {
  enabled: false,
  phoneNumberId: "",
  accessToken: "",
  templateName: "",
  languageCode: "bn",
  templateBody:
    "আসসালামু আলাইকুম {{1}}! আপনার অর্ডার ({{2}}) কনফার্ম হয়েছে। প্যাকেজ: {{3}}, পরিমাণ: {{4}}টি, মোট: ৳{{5}} (ক্যাশ অন ডেলিভারি)। আমাদের প্রতিনিধি শীঘ্রই কল করবেন। — ঘুমপাড়া বেবি",
};

/** Slot legend shown under the template textarea in admin. */
export const TEMPLATE_SLOT_LEGEND: { slot: string; meaning: string }[] = [
  { slot: "{{1}}", meaning: "কাস্টমারের নাম" },
  { slot: "{{2}}", meaning: "অর্ডার কোড" },
  { slot: "{{3}}", meaning: "প্যাকেজের নাম" },
  { slot: "{{4}}", meaning: "পরিমাণ (পিস)" },
  { slot: "{{5}}", meaning: "সর্বমোট টাকা" },
];

const MAX_LEN: Record<keyof Omit<WhatsappConfig, "enabled">, number> = {
  phoneNumberId: 64,
  accessToken: 500,
  templateName: 128,
  languageCode: 16,
  templateBody: 2000,
};

/** Sanitize anything coming from DB/admin into a valid WhatsappConfig. */
export function sanitizeWhatsappConfig(input: unknown): WhatsappConfig | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const str = (k: keyof typeof MAX_LEN): string => {
    const v = rec[k];
    if (typeof v !== "string") return "";
    return v.trim().slice(0, MAX_LEN[k]);
  };
  return {
    enabled: rec.enabled === true,
    phoneNumberId: str("phoneNumberId"),
    accessToken: str("accessToken"),
    templateName: str("templateName"),
    languageCode: str("languageCode") || "bn",
    templateBody: str("templateBody"),
  };
}

/** Ready to actually send (enabled + all Meta credentials present). */
export function isWhatsappReady(config: WhatsappConfig): boolean {
  return (
    config.enabled &&
    config.phoneNumberId.length > 0 &&
    config.accessToken.length > 0 &&
    config.templateName.length > 0
  );
}
