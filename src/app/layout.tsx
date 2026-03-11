import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { readSiteConfig } from "@/lib/site-content-loader";
import { AosProvider } from "@/components/site/aos-provider";
import "./globals.css";
import "aos/dist/aos.css";

export const dynamic = "force-static";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();

  return {
    title: site.brand.mark,
    description: site.announcement,
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
        <AosProvider>{children}</AosProvider>
      </body>
    </html>
  );
}
