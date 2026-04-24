import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AfricaRentalGrid | East Africa Property Discovery",
    template: "%s | AfricaRentalGrid"
  },
  description:
    "AfricaRentalGrid helps users discover verified hostels, bedsitters, lodges, and rental plots across Kenya, Uganda, and Tanzania.",
  openGraph: {
    type: "website",
    locale: "en_KE",
    siteName: "AfricaRentalGrid"
  },
  twitter: {
    card: "summary_large_image"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
