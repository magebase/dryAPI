import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { readSiteConfig } from "@/lib/site-content-loader";
import { AosProvider } from "@/components/site/aos-provider";
import { SerwistRegister } from "@/components/site/serwist-register";
import "./globals.css";
import "aos/dist/aos.css";

export const dynamic = "force-static";

const FALLBACK_SITE_URL = "https://genfix.com.au";

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();
  const siteUrl = normalizeSiteUrl();

  return {
    title: site.brand.mark,
    description: site.announcement,
    metadataBase: new URL(siteUrl),
    applicationName: site.brand.mark,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: site.brand.mark,
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        {
          url: "/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
          <NuqsAdapter>
            <SerwistRegister />
            <AosProvider>{children}</AosProvider>
          </NuqsAdapter>
      </body>
    </html>
  );
}
