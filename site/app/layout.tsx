import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = "https://prahari.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "prahari — the sentinel for your environment config",
  description:
    "Type-safe, self-documenting environment variables for TypeScript. Fail loudly at boot, never let your .env.example drift, and a CLI nobody else has.",
  keywords: [
    "typescript",
    "environment variables",
    "env",
    "dotenv",
    "type-safe",
    "config validation",
    "zod",
    "node",
    "prahari",
  ],
  authors: [{ name: "Kripa Sindhu" }],
  openGraph: {
    title: "prahari — the sentinel for your environment config",
    description:
      "Type-safe env for TypeScript that fails loudly at boot, plus a CLI that keeps your .env.example honest.",
    url: siteUrl,
    siteName: "prahari",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "prahari — the sentinel for your environment config",
    description:
      "Type-safe env for TypeScript that fails loudly at boot, plus a CLI that keeps your .env.example honest.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
