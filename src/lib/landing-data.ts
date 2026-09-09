export const HOTLINE = "01713-510047";
export const HOTLINE_LINK = "tel:+8801713510047";

// WhatsApp (same number, international format without +)
export const WHATSAPP_NUMBER = "8801713510047";
export const WHATSAPP_DISPLAY = "01713-510047";
export const WHATSAPP_MESSAGE =
  "আসসালামু আলাইকুম! আমি ঘুমপাড়া বেবি সোয়াডেল সম্পর্কে জানতে চাই।";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`;

export const PRODUCT_COLORS = [
  { id: "blue", label: "আকাশি", hex: "#8FAFD4", image: "/images/swaddle-blue.jpg" },
  { id: "pink", label: "গোলাপি", hex: "#F2B8C2", image: "/images/swaddle-pink.jpg" },
  { id: "red", label: "লাল", hex: "#A93B32", image: "/images/swaddle-red.jpg" },
  { id: "beige", label: "বেইজ", hex: "#C4B3A0", image: "/images/swaddle-beige.jpg" },
  { id: "cream", label: "ক্রিম", hex: "#F0EBDD", image: "/images/swaddle-cream.jpg" },
  { id: "grey", label: "ধূসর", hex: "#8E8E93", image: "/images/swaddle-grey.jpg" },
] as const;

export function toBn(num: number): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((ch) => (/\d/.test(ch) ? bnDigits[Number(ch)] : ch))
    .join("");
}
