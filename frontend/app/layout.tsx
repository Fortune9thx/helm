import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "@/components/Providers";
import { AppNav } from "@/components/AppNav";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helm — Intelligent Operational Control Layer",
  description:
    "Register natural-language operational policies for on-chain protocols. Helm fetches live data, evaluates policy under GenLayer's Equivalence Principle, and records a consensus-backed operational decision.",
};

// Every route depends on client-side wallet state (RainbowKit/wagmi), so
// there's nothing meaningful to statically prerender -- and
// getDefaultConfig throws at module-init time without a WalletConnect
// projectId, which would otherwise crash the build's static generation
// pass even though the app runs fine once a real projectId is set.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-void text-text-primary">
        <div className="ambient-field" aria-hidden="true" />
        <Providers>
          <AppNav />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
