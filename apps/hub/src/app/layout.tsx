import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "APIScore — AI API Discovery Hub",
    template: "%s | APIScore",
  },
  description:
    "Discover, compare, and benchmark AI APIs. Find the fastest, cheapest, and most reliable LLM APIs for your use case.",
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    siteName: "APIScore",
    url: siteUrl,
    images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: "APIScore — AI API Discovery Hub" }],
  },
  twitter: {
    card: "summary_large_image",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
