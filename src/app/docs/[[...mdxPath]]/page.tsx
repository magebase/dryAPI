import { DocumentationPage, generateDocsMetadata, getDocsStaticParams } from "@/components/docs/docs-page"
import { DEFAULT_LOCALE } from "@/lib/i18n"

export const dynamic = "force-static"

export function generateStaticParams() {
  return getDocsStaticParams(DEFAULT_LOCALE)
}

export async function generateMetadata(props: { params: Promise<{ mdxPath?: string[] }> }) {
  const params = await props.params
  return await generateDocsMetadata(params.mdxPath, DEFAULT_LOCALE)
}

export default async function DocsPageRoute(props: { params: Promise<{ mdxPath?: string[] }> }) {
  const params = await props.params
  return <DocumentationPage slug={params.mdxPath} locale={DEFAULT_LOCALE} />
}
