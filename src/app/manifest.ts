import type { MetadataRoute } from "next"

import { readSiteConfig } from "@/lib/site-content-loader"

const THEME_COLOR = "#ff8b2b"
const BACKGROUND_COLOR = "#0b1420"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await readSiteConfig()

  return {
    id: "/",
    name: site.brand.name,
    short_name: site.brand.mark,
    description: site.announcement,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
