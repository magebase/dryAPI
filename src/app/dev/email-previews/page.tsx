import Link from "next/link"
import { notFound } from "next/navigation"

import { emailPreviewCatalog } from "@/emails/preview-catalog"
import { readBrandCatalog } from "@/lib/brand-catalog"

type EmailPreviewIndexPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function resolveSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || ""
  }

  return value || ""
}

export default async function EmailPreviewIndexPage({ searchParams }: EmailPreviewIndexPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const selectedBrandKey = resolveSearchParam(params.brand)
  const catalog = await readBrandCatalog()
  const activeBrand = catalog.brands.find((brand) => brand.key === selectedBrandKey) || catalog.brands.find((brand) => brand.key === catalog.defaultBrandKey)

  if (!activeBrand) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Email previews</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">Brand-aware email catalog</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          Review every transactional, internal, and campaign template in-browser for the active brand. Use the HTML preview for visual QA and the text preview to check the plain-text fallback.
        </p>
      </header>

      <section className="mb-10 flex flex-wrap gap-3">
        {catalog.brands.map((brand) => {
          const isActive = brand.key === activeBrand.key

          return (
            <Link
              key={brand.key}
              href={`/dev/email-previews?brand=${brand.key}`}
              className={isActive
                ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"
              }
            >
              {brand.displayName}
            </Link>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {emailPreviewCatalog.map((template) => (
          <article key={template.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{template.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{template.label}</h2>
            <p className="mt-1 text-sm text-slate-600">Preview this template for {activeBrand.displayName}.</p>
            <div className="mt-5 flex items-center gap-3 text-sm font-semibold">
              <Link
                href={`/dev/email-previews/render/${template.slug}?brand=${activeBrand.key}`}
                target="_blank"
                className="rounded-lg bg-slate-950 px-3 py-2 text-white hover:bg-slate-800"
              >
                Open HTML
              </Link>
              <Link
                href={`/dev/email-previews/render/${template.slug}?brand=${activeBrand.key}&format=text`}
                target="_blank"
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:border-slate-300 hover:text-slate-950"
              >
                Open text
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}