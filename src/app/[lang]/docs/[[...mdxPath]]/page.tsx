import { notFound } from "next/navigation";

import {
  DocumentationPage,
  generateDocsMetadata,
  getLocalizedDocsStaticParams,
} from "@/components/docs/docs-page";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "@/lib/i18n";

export function generateStaticParams() {
  return getLocalizedDocsStaticParams(
    SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE),
  );
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const params = await props.params;

  if (!isSupportedLocale(params.lang) || params.lang === DEFAULT_LOCALE) {
    notFound();
  }

  return await generateDocsMetadata(params.mdxPath, params.lang);
}

export default async function LocalizedDocsPage(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>;
}) {
  const params = await props.params;

  if (!isSupportedLocale(params.lang) || params.lang === DEFAULT_LOCALE) {
    notFound();
  }

  return <DocumentationPage slug={params.mdxPath} locale={params.lang} />;
}
