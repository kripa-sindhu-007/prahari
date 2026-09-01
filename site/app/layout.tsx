import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

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

// Canonical site URL. Sourced from lib/site — switch site.url to a custom
// domain (e.g. https://prahari.dev) there once it's pointed at the site.
const siteUrl = site.url;

const description =
  "Type-safe environment variables for TypeScript, validated at boot — with a drift-proof CLI, bring your own Zod/Valibot/ArkType, and Next.js & Vite server/client guards.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "prahari — type-safe environment variables for TypeScript",
    template: "%s · prahari",
  },
  description,
  keywords: [
    "typescript environment variables",
    "type-safe env",
    "env validation",
    "dotenv typescript",
    "zod env",
    "valibot",
    "arktype",
    "standard schema",
    "t3-env alternative",
    "next.js env",
    "vite env",
    ".env.example generator",
    "env drift",
    "prahari",
  ],
  authors: [{ name: "Kripa Sindhu" }],
  creator: "Kripa Sindhu",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "prahari — type-safe environment variables for TypeScript",
    description,
    url: siteUrl,
    siteName: "prahari",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "prahari — type-safe environment variables for TypeScript",
    description,
  },
};

// Structured data — helps search engines classify the project.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "prahari",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js",
  description,
  url: siteUrl,
  softwareVersion: site.version,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Kripa Sindhu" },
  license: "https://opensource.org/licenses/MIT",
  codeRepository: site.repo,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
