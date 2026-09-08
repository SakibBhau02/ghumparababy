import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FacebookPixel } from "@/components/landing/facebook-pixel";

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ঘুমপাড়া বেবি — মোরো রিফ্লেক্স প্রিভেনশন সোয়াডেল | শান্ত ঘুমের নিশ্চয়তা",
  description:
    "নবজাতকের মোরো রিফ্লেক্স (চমকে ওঠা) কমিয়ে গভীর ঘুম নিশ্চিত করে ঘুমপাড়া বেবি সোয়াডেল। শীতের ঠান্ডা ও কাশি থেকেও সুরক্ষা। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি, ফ্রি ডেলিভারি অফার।",
  keywords: [
    "সোয়াডেল",
    "নবজাতকের সোয়াডেল",
    "মোরো রিফ্লেক্স",
    "baby swaddle bangladesh",
    "নিউবর্ন বেবি প্রোডাক্ট",
    "শীতের বেবি প্রোডাক্ট",
  ],
  icons: {
    icon: "/images/swaddle-pink.jpg",
  },
  openGraph: {
    title: "ঘুমপাড়া বেবি — শান্ত ঘুম, নিরাপদ শৈশব",
    description:
      "মোরো রিফ্লেক্স কমিয়ে বাচ্চাকে দিন গভীর ঘুম। সারা দেশে ক্যাশ অন ডেলিভারি।",
    type: "website",
    locale: "bn_BD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#C2553D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body
        className={`${hindSiliguri.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <FacebookPixel />
      </body>
    </html>
  );
}
