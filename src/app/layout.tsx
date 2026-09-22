import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { m } from "@/lib/messages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: m.app.name,
  description: m.app.description,
  // Better "Add to Home Screen" behavior on iOS (Safari does not read manifest.ts for this).
  appleWebApp: { capable: true, statusBarStyle: "default", title: m.app.name },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={m.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
