import Image from "next/image"
import { ArrowRight, MessageSquare } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { BlogArticleCatalog } from "@/components/site/blog-article-catalog"
import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { BlogPost, RoutePage, SiteConfig } from "@/lib/site-content-schema"

type BlogListPageTemplateProps = {
  page: RoutePage
  posts: BlogPost[]
  site: SiteConfig
}

export function BlogListPageTemplate({ page, posts, site }: BlogListPageTemplateProps) {
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const productsLink = site.header.primaryLinks.find((link) => link.href === "/products")
  const heroGalleryImages = page.hero.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []
  const ctaKicker = resolveSiteUiText(site, "blogList.ctaKicker", "Need Cost And Scale Guidance?")
  const ctaHeading = resolveSiteUiText(site, "blogList.ctaHeading", "Talk To An AI API Architect")
  const ctaBody = resolveSiteUiText(
    site,
    "blogList.ctaBody",
    "Get practical recommendations for routing, caching, pricing, and production rollout."
  )
  const explorePrefix = resolveSiteUiText(site, "blogList.explorePrefix", "Explore")

  return (
    <main className="overflow-x-clip bg-[var(--site-surface-0)] pb-16 text-slate-900 md:pb-20">
      <section className="relative isolate overflow-hidden border-b border-slate-200">
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          height={1080}
          priority
          src={page.hero.image}
          width={1920}
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,15,24,0.95),rgba(7,15,24,0.76),rgba(7,15,24,0.88))]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px]" />

        <Reveal className="relative mx-auto max-w-7xl px-4 pb-14 pt-20 md:pb-16 md:pt-24 lg:pb-24 lg:pt-28">
          <p className="text-xs uppercase tracking-[0.22em] text-primary" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="text-site-inverse mt-4 max-w-3xl font-display text-3xl uppercase leading-[1.05] tracking-[0.03em] sm:text-4xl md:text-6xl">
            <KeywordGradientText dataTinaField={tinaField(page.hero, "heading")} text={page.hero.heading} />
          </h1>
          <p className="text-site-inverse-muted mt-5 max-w-2xl text-sm sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {page.hero.actions.map((action, index) => (
              <QuoteAwareLink
                key={`${action.href}-${action.label}`}
                className={`inline-flex items-center justify-center gap-1.5 w-full rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition sm:w-auto ${
                  index === 0
                    ? "border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] text-primary-foreground shadow-lg hover:brightness-110"
                    : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                }`}
                data-tina-field={tinaField(action)}
                href={action.href}
                quoteLabel={action.label}
              >
                <span>{action.label}</span>
                <ArrowRight className="size-4" />
              </QuoteAwareLink>
            ))}
          </div>

          {heroGalleryImages.length > 0 ? (
            <div className="mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3" data-tina-field={tinaField(page.hero, "galleryImages")}>
              {heroGalleryImages.slice(0, 6).map((image) => (
                <div key={image.id} className={`${getGradientVariant(0)} overflow-hidden rounded-sm border border-slate-300`}>
                  <Image
                    alt={image.alt || `${page.hero.heading} gallery image`}
                    className="h-24 w-full object-cover"
                    data-tina-field={tinaField(image, "src")}
                    height={240}
                    src={image.src}
                    width={420}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>
      </section>

      <BlogArticleCatalog posts={posts} site={site} />

      {page.sections.map((section) => (
        <section key={section.id} className="mx-auto mt-12 max-w-7xl px-4">
          <Reveal as="div" className={`${getGradientVariant(2)} rounded-md border border-slate-200 px-6 py-7`}>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.1em] text-slate-900 md:text-3xl">
              <KeywordGradientText dataTinaField={tinaField(section, "title")} text={section.title} />
            </h2>
            <p className="mt-3 max-w-3xl text-slate-600" data-tina-field={tinaField(section, "body")}>{section.body}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card, index) => (
                <Reveal
                  as="article"
                  key={card.id}
                  className={`${getGradientVariant(index + 1)} overflow-hidden rounded-md border border-slate-200`}
                  delay={index * 0.08}
                  data-tina-field={tinaField(card)}
                >
                  {card.image ? (
                    <Image
                      alt={card.title}
                      className="h-40 w-full object-cover"
                      data-tina-field={tinaField(card, "image")}
                      height={340}
                      src={card.image}
                      width={560}
                    />
                  ) : null}
                  <div className="p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">
                      <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                    </h3>
                    <p className="mt-3 text-sm text-slate-600" data-tina-field={tinaField(card, "description")}>
                      {card.description}
                    </p>
                    <QuoteAwareLink
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary hover:text-accent"
                      data-tina-field={tinaField(card, "ctaLabel")}
                      href={card.href}
                      quoteLabel={card.ctaLabel}
                    >
                      <span>{card.ctaLabel}</span>
                      <ArrowRight className="size-4" />
                    </QuoteAwareLink>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </section>
      ))}

      <section className="mx-auto mt-12 max-w-7xl px-4">
        <Reveal className={`${getGradientVariant(3)} rounded-md border border-slate-200 px-5 py-5 md:flex md:items-center md:justify-between md:gap-8 md:px-6 md:py-6`}>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-primary" data-tina-field={ctaKicker.field}>
              <MessageSquare className="size-4" />
              <span>{ctaKicker.value}</span>
            </p>
            <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.06em] text-slate-900">
              <KeywordGradientText dataTinaField={ctaHeading.field} text={ctaHeading.value} />
            </h2>
            <p className="mt-2 text-sm text-slate-600" data-tina-field={ctaBody.field}>{ctaBody.value}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition hover:brightness-110 sm:w-auto"
              data-tina-field={tinaField(site.header, "quoteCta")}
              forceQuoteModal
              href={quoteHref}
              quoteLabel={quoteLabel}
            >
              <span>{quoteLabel}</span>
              <ArrowRight className="size-4" />
            </QuoteAwareLink>
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-700 transition hover:border-white hover:text-slate-900 sm:w-auto"
              data-tina-field={productsLink ? tinaField(productsLink) : undefined}
              href={productsLink?.href ?? "/products"}
            >
              <span data-tina-field={explorePrefix.field}>{explorePrefix.value}</span>{" "}
              <span>{productsLink?.label ?? "Products"}</span>
              <ArrowRight className="size-4" />
            </QuoteAwareLink>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
