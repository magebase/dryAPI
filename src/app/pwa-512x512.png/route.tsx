import { ImageResponse } from "next/og"

import { PwaIconImage } from "@/app/pwa-icon-image"

export const runtime = "nodejs"

export async function GET() {
  const size = 512

  return new ImageResponse(<PwaIconImage includeInsetRing size={size} />, {
    width: size,
    height: size,
  })
}
