import { Suspense } from "react";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { readSiteConfig } from "@/lib/site-content-loader";
import { isPwaEnabledServer } from "@/lib/feature-flags";
import { AosProvider } from "@/components/site/aos-provider";
import { AppToaster } from "@/components/site/app-toaster";
import { AppProviders } from "@/components/site/app-providers";
import { SerwistRegister } from "@/components/site/serwist-register";
import { buildTakumiMetadata, normalizeSiteUrl } from "@/lib/og/metadata";
import "./globals.css";
import "aos/dist/aos.css";

const FALLBACK_SITE_URL = "https://dryapi.dev";

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();
  const siteUrl = normalizeSiteUrl() || FALLBACK_SITE_URL;
  const siteName = site.brand.name || site.brand.mark;
  const pwaEnabled = isPwaEnabledServer();
  const baseMetadata = buildTakumiMetadata({
    title: site.brand.mark,
    description: site.announcement,
    canonicalPath: "/",
    template: "marketing",
    siteName,
    label: "Marketing",
    seed: "root-layout",
  });

  return {
    ...baseMetadata,
    metadataBase: new URL(siteUrl),
    applicationName: site.brand.mark,
    manifest: pwaEnabled ? "/manifest.webmanifest" : undefined,
    appleWebApp: pwaEnabled
      ? {
          capable: true,
          statusBarStyle: "default",
          title: site.brand.mark,
        }
      : undefined,
    formatDetection: {
      telephone: false,
    },
    icons: pwaEnabled
      ? {
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
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pwaEnabled = isPwaEnabledServer();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className="font-manrope font-dm-sans font-fira-code"
    >
      <body className="m-0 antialiased">
        <NuqsAdapter>
          <AppProviders>
            {pwaEnabled ? <SerwistRegister /> : null}
            <Suspense fallback={null}>
              <AosProvider>{children}</AosProvider>

              <AppToaster />
            </Suspense>
          </AppProviders>
        </NuqsAdapter>
      </body>
    </html>
  );
}
