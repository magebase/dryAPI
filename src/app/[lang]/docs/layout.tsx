import { notFound } from "next/navigation"

import { DocumentationLayout } from "@/components/docs/docs-layout"
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n"

export const dynamic = "force-static"

export default async function LocalizedDocsLayout(props: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const params = await props.params

  if (!isSupportedLocale(params.lang) || params.lang === DEFAULT_LOCALE) {
    notFound()
  }

  return <DocumentationLayout locale={params.lang}>{props.children}</DocumentationLayout>
}