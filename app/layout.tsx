import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster as Sonner } from "@/components/ui/sonner"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Growth Engine - Dashboard",
  description: "AI-Powered Automation & Booking Platform",
  keywords: "growth automation, AI assistant, appointment booking, client retention, CRM",
  authors: [{ name: "Scale with JAK" }],
  openGraph: {
    title: "Growth Engine - Dashboard",
    description: "AI-Powered Automation & Booking Platform",
    type: "website",
    images: [
      {
        url: "https://example.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Growth Engine Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growth Engine - Dashboard",
    description: "AI-Powered Automation & Booking Platform",
    images: ["/og-image.png"],
  },
  robots: {
    index: false, // Don't index client dashboards
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers locale="en">
          {children}
          <Toaster />
          <Sonner />
        </Providers>
      </body>
    </html>
  );
}
