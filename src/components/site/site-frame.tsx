"use client"

import { usePathname } from "next/navigation"

import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import type { SiteConfig } from "@/lib/site-content-schema"

export function SiteFrame({ site, children }: { site: SiteConfig; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0b121b] text-slate-100">
      <SiteHeader pathname={pathname} site={site} />
      {children}
      <SiteFooter site={site} />
    </div>
  )
}
