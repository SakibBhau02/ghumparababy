export const HOTLINE = "01850-123456";
export const HOTLINE_LINK = "tel:+8801850123456";

export const PRODUCT_COLORS = [
  { id: "blue", label: "আকাশি", hex: "#8FAFD4", image: "/images/swaddle-blue.jpg" },
  { id: "pink", label: "গোলাপি", hex: "#F2B8C2", image: "/images/swaddle-pink.jpg" },
  { id: "red", label: "লাল", hex: "#A93B32", image: "/images/swaddle-red.jpg" },
  { id: "beige", label: "বেইজ", hex: "#C4B3A0", image: "/images/swaddle-beige.jpg" },
  { id: "cream", label: "ক্রিম", hex: "#F0EBDD", image: "/images/swaddle-cream.jpg" },
  { id: "grey", label: "ধূসর", hex: "#8E8E93", image: "/images/swaddle-grey.jpg" },
] as const;

export const PACKAGES = [
  {
    id: "single",
    name: "সিঙ্গেল প্যাক",
    qty: "১টি সোয়াডেল",
    price: 549,
    oldPrice: 899,
    save: 350,
    tag: null,
  },
  {
    id: "combo2",
    name: "কম্বো প্যাক",
    qty: "২টি সোয়াডেল",
    price: 999,
    oldPrice: 1798,
    save: 799,
    tag: "সবচেয়ে জনপ্রিয়",
  },
  {
    id: "combo3",
    name: "ফ্যামিলি প্যাক",
    qty: "৩টি সোয়াডেল",
    price: 1399,
    oldPrice: 2697,
    save: 1298,
    tag: "সেরা ভ্যালু",
  },
] as const;

export function toBn(num: number): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((ch) => (/\d/.test(ch) ? bnDigits[Number(ch)] : ch))
    .join("");
}
