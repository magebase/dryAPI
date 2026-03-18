import type { Metadata } from "next"
import { DocumentationLayout } from "@/components/docs/docs-layout"
import { DEFAULT_LOCALE } from "@/lib/i18n"
import { buildTakumiMetadata } from "@/lib/og/metadata"
import { readSiteConfig } from "@/lib/site-content-loader"

export const dynamic = "force-static"

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig()

  return buildTakumiMetadata({
    title: "dryAPI Docs",
    description:
      "Reference documentation for the dryAPI platform, including versioned API docs and integration guides.",
    canonicalPath: "/docs",
    template: "marketing",
    siteName: site.brand.name || site.brand.mark,
    label: "Docs Page",
    seed: "docs-layout",
  })
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationLayout locale={DEFAULT_LOCALE}>{children}</DocumentationLayout>
}
