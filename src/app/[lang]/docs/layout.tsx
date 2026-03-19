import { notFound } from "next/navigation";

import { DocumentationLayout } from "@/components/docs/docs-layout";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n";
import { resolveActiveBrand } from "@/lib/brand-catalog";

export default async function LocalizedDocsLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const [params, brand] = await Promise.all([props.params, resolveActiveBrand()]);

  if (!isSupportedLocale(params.lang) || params.lang === DEFAULT_LOCALE) {
    notFound();
  }

  return (
    <DocumentationLayout locale={params.lang} brand={brand}>
      {props.children}
    </DocumentationLayout>
  );
}
