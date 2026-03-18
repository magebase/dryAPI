import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DashboardShell } from "@/components/site/dashboard/dashboard-shell"
import { buildTakumiMetadata } from "@/lib/og/metadata"
import { readSiteConfig } from "@/lib/site-content-loader"

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig()

  return buildTakumiMetadata({
    title: "Dashboard | dryAPI",
    description: "Operational dashboard for API usage, keys, billing, and model routing.",
    canonicalPath: "/dashboard",
    template: "dashboard",
    siteName: site.brand.name || site.brand.mark,
    robots: {
      index: false,
      follow: false,
    },
    label: "Dashboard",
    seed: "dashboard-layout",
  })
}

type DashboardLayoutProps = {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardShell>{children}</DashboardShell>
}
