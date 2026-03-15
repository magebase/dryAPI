import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  Sora,
  Manrope,
  DM_Sans,
  Fira_Code,
  Geist,
  Geist_Mono,
} from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { readSiteConfig } from "@/lib/site-content-loader";
import { isPwaEnabledServer } from "@/lib/feature-flags";
import { AosProvider } from "@/components/site/aos-provider";
import { AppToaster } from "@/components/site/app-toaster";
import { SerwistRegister } from "@/components/site/serwist-register";
import "./globals.css";
import "aos/dist/aos.css";
import { cn } from "@/lib/utils";

const firaCode = Fira_Code({
  subsets: [
    "cyrillic",
    "cyrillic-ext",
    "greek",
    "greek-ext",
    "latin",
    "latin-ext",
    "symbols2",
  ],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-code",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: [
    "100",
    "1000",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ],
  variable: "--font-dm-sans",
});

const manrope = Manrope({
  subsets: [
    "cyrillic",
    "cyrillic-ext",
    "greek",
    "latin",
    "latin-ext",
    "vietnamese",
  ],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const dynamic = "force-static";

const FALLBACK_SITE_URL = "https://genfix.com.au";

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(
    /\/+$/,
    "",
  );
}

const geist = Geist({
  subsets: ["latin-ext"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin-ext"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-geist-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();
  const siteUrl = normalizeSiteUrl();
  const pwaEnabled = isPwaEnabledServer();

  return {
    title: site.brand.mark,
    description: site.announcement,
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
      className={cn(
        "font-manrope",
        "font-dm-sans",
        "font-fira-code",
        manrope.variable,
        dmSans.variable,
        firaCode.variable,
      )}
    >
      <body
        className={`${manrope.variable} ${dmSans.variable} ${firaCode.variable} antialiased`}
      >
        <NuqsAdapter>
          {pwaEnabled ? <SerwistRegister /> : null}
          <AosProvider>{children}</AosProvider>
          <AppToaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
