import type { Metadata } from "next"
import { DocumentationLayout } from "@/components/docs/docs-layout"
import { DEFAULT_LOCALE } from "@/lib/i18n"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: {
    default: "dryAPI Docs",
    template: "%s | dryAPI Docs",
  },
  description:
    "Reference documentation for the dryAPI platform, including versioned API docs and integration guides.",
  alternates: {
    canonical: "/docs",
  },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationLayout locale={DEFAULT_LOCALE}>{children}</DocumentationLayout>
}
