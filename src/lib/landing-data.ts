import { siteImage } from "@/lib/site-images";

export const HOTLINE = "01713-510047";export const HOTLINE_LINK = "tel:+8801713510047";

// WhatsApp (same number, international format without +)
export const WHATSAPP_NUMBER = "8801713510047";
export const WHATSAPP_DISPLAY = "01713-510047";
export const WHATSAPP_MESSAGE =
  "আসসালামু আলাইকুম! আমি ঘুমপাড়া বেবি সোয়াডেল সম্পর্কে জানতে চাই।";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`;

export const PRODUCT_COLORS = [
  { id: "blue", label: "আকাশি", hex: "#6B8EDE", image: siteImage("/images/swaddle-blue.jpg") },
  { id: "red", label: "লাল", hex: "#8B1E2A", image: siteImage("/images/swaddle-red.jpg") },
  { id: "brown", label: "বাদামি", hex: "#B5883D", image: siteImage("/images/swaddle-brown.jpg") },
  { id: "pink", label: "গোলাপি", hex: "#F2B8C2", image: siteImage("/images/swaddle-pink.jpg") },
] as const;

export function toBn(num: number): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((ch) => (/\d/.test(ch) ? bnDigits[Number(ch)] : ch))
    .join("");
}
