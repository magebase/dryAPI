import type { Metadata } from "next"
import { DocumentationLayout } from "@/components/docs/docs-layout"
import { DEFAULT_LOCALE } from "@/lib/i18n"
import { buildTakumiMetadata } from "@/lib/og/metadata"
import { readSiteConfig } from "@/lib/site-content-loader"
import { resolveActiveBrand } from "@/lib/brand-catalog"

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig()

  return buildTakumiMetadata({
    title: `${site.brand.mark} Docs`,
    description:
      `Reference documentation for the ${site.brand.mark} platform, including versioned API docs and integration guides.`,
    canonicalPath: "/docs",
    template: "marketing",
    siteName: site.brand.name || site.brand.mark,
    label: "Docs Page",
    seed: "docs-layout",
  })
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const brand = await resolveActiveBrand()
  return <DocumentationLayout locale={DEFAULT_LOCALE} brand={brand}>{children}</DocumentationLayout>
}
