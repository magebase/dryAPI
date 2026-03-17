import Image from "next/image"
import { tinaField } from "tinacms/dist/react"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"

type ProductsPageTemplateProps = {
  page: RoutePage
  productPages: RoutePage[]
  site: SiteConfig
}

type ProductFeature = {
  id: string
  title: string
  description: string
  image: string
  galleryImages: Array<{ id: string; src: string; alt?: string; caption?: string }>
  href: string
  specs: string[]
  ctaLabel: string
  titleField: string
  descriptionField: string
  ctaField: string
}

function buildProductFeatures(productPages: RoutePage[]): ProductFeature[] {
  return productPages.map((productPage) => {
    const specs = productPage.sections
      .flatMap((section) => section.cards.map((card) => card.title.toUpperCase()))
      .slice(0, 4)

    return {
      id: productPage.slug,
      title: productPage.hero.heading,
      description: productPage.hero.body,
      image: productPage.hero.image,
      galleryImages: productPage.hero.galleryImages ?? [],
      href: productPage.slug,
      specs,
      ctaLabel: productPage.hero.actions[0]?.label ?? "View Products",
      titleField: tinaField(productPage.hero, "heading"),
      descriptionField: tinaField(productPage.hero, "body"),
      ctaField: productPage.hero.actions[0]
        ? tinaField(productPage.hero.actions[0], "label")
        : tinaField(productPage.hero, "actions"),
    }
  })
}

function buildFallbackFeatures(page: RoutePage): ProductFeature[] {
  const sectionSpecs = page.sections.map((section) => section.title.toUpperCase()).slice(0, 4)

  return page.sections
    .flatMap((section) => section.cards)
    .slice(0, 4)
    .map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      image: card.image ?? page.hero.image,
      galleryImages: page.hero.galleryImages ?? [],
      href: card.href,
      specs: sectionSpecs,
      ctaLabel: card.ctaLabel,
      titleField: tinaField(card, "title"),
      descriptionField: tinaField(card, "description"),
      ctaField: tinaField(card, "ctaLabel"),
    }))
}

export function ProductsPageTemplate({ page, productPages, site }: ProductsPageTemplateProps) {
  const brandMark = site.brand.mark
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const heroGalleryImages = page.hero.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []
  const features =
    productPages.length > 0 ? buildProductFeatures(productPages) : buildFallbackFeatures(page)
  const faqItems =
    features.length > 0
      ? features.slice(0, 6).map((feature) => ({
          question: feature.title,
          answer: feature.description,
          questionField: feature.titleField,
          answerField: feature.descriptionField,
        }))
      : [
          {
            question: page.hero.heading,
            answer: page.hero.body,
            questionField: tinaField(page.hero, "heading"),
            answerField: tinaField(page.hero, "body"),
          },
        ]
  const systemsShowcaseImage =
    heroGalleryImages[0]?.src ?? "https://images.unsplash.com/photo-1567789884554-0b844b597180"

  const expertsKicker = resolveSiteUiText(site, "productsPage.expertsKicker", "5-20 kVA Diesel Generation Experts")
  const expertsHeading = resolveSiteUiText(
    site,
    "productsPage.expertsHeading",
    "Engineered Systems For Tough Australian Operating Conditions"
  )
  const expertsBody = resolveSiteUiText(
    site,
    "productsPage.expertsBody",
    `${brandMark} supplies robust 5-20 kVA diesel generator systems for site services, shutdowns, and critical backup. Our team combines planning, deployment, and continuous service support to keep power online in demanding environments.`
  )
  const rangeKicker = resolveSiteUiText(site, "productsPage.rangeKicker", "Our 5-20 kVA Diesel Generator Range")
  const packagesHeading = resolveSiteUiText(site, "productsPage.packagesHeading", "5-20 kVA Diesel Packages")
  const packagesBody = resolveSiteUiText(
    site,
    "productsPage.packagesBody",
    "We collaborate with your site team to configure enclosure, controls, and fuel-system requirements for 5-20 kVA diesel outcomes. Options are aligned to duty cycles, environmental constraints, and compliance targets."
  )
  const packagesPanelKicker = resolveSiteUiText(
    site,
    "productsPage.packagesPanelKicker",
    "For Site, Commercial, And Industrial Use"
  )
  const packagesPanelBody = resolveSiteUiText(
    site,
    "productsPage.packagesPanelBody",
    `${brandMark} is a trusted supplier for site operations that need dependable 5-20 kVA diesel power. Our rental and sales packages are designed to maintain uptime and simplify field operations from day one.`
  )
  const faqHeading = resolveSiteUiText(site, "productsPage.faqHeading", "Frequently Asked Questions")

  return (
    <main className="overflow-x-clip bg-[var(--site-surface-0)] text-slate-900">
      <section className="relative isolate border-b border-slate-200">
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          height={1080}
          priority
          src={page.hero.image}
          width={1920}
        />
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(5,11,17,0.93)_14%,rgba(5,11,17,0.78)_54%,rgba(5,11,17,0.9)_100%)]" />
        <div className="absolute right-0 top-0 hidden h-full w-44 bg-gradient-to-b from-primary/20 via-primary/45 to-primary/10 [clip-path:polygon(36%_0,100%_0,66%_35%,100%_68%,44%_100%,0_100%,38%_66%,0_35%)] lg:block" />

        <Reveal className="relative mx-auto max-w-7xl px-4 pb-14 pt-20 md:pb-20 md:pt-24 lg:pb-28 lg:pt-28">
          <p className="text-xs uppercase tracking-[0.26em] text-primary" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-3xl uppercase leading-[1.05] tracking-[0.03em] text-slate-900 sm:text-4xl md:text-6xl">
            <KeywordGradientText dataTinaField={tinaField(page.hero, "heading")} text={page.hero.heading} />
          </h1>
          <p className="mt-5 max-w-2xl text-sm text-slate-600 sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {page.hero.actions.map((action) => (
              <QuoteAwareLink
                key={action.href}
                className="inline-flex w-full justify-center rounded-sm border border-primary bg-primary/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary hover:text-primary-foreground sm:w-auto"
                data-tina-field={tinaField(action)}
                href={action.href}
                quoteLabel={action.label}
              >
                {action.label}
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
                    height={230}
                    src={image.src}
                    width={400}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>
      </section>

      <Reveal className="border-b border-slate-200 bg-[linear-gradient(180deg,#101a2b,#132034)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.24em] text-primary" data-tina-field={expertsKicker.field}>{expertsKicker.value}</p>
            <h2 className="max-w-xl font-display text-3xl uppercase leading-tight tracking-[0.03em] text-slate-900 md:text-4xl">
              <KeywordGradientText dataTinaField={expertsHeading.field} text={expertsHeading.value} />
            </h2>
            <p className="max-w-xl text-slate-600" data-tina-field={expertsBody.field}>{expertsBody.value}</p>
          </div>
          <div className={`${getGradientVariant(1)} relative overflow-hidden rounded-sm border border-slate-200 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)]`}>
            <Image
              alt="Industrial generator fleet"
              className="h-full w-full object-cover"
              height={720}
              src={systemsShowcaseImage}
              width={1200}
            />
            <div className="pointer-events-none absolute bottom-4 left-4 h-10 w-20 bg-[radial-gradient(circle_at_20%_20%,var(--primary)_20%,transparent_22%),radial-gradient(circle_at_60%_20%,var(--primary)_20%,transparent_22%),radial-gradient(circle_at_100%_20%,var(--primary)_20%,transparent_22%),radial-gradient(circle_at_20%_60%,var(--primary)_20%,transparent_22%),radial-gradient(circle_at_60%_60%,var(--primary)_20%,transparent_22%),radial-gradient(circle_at_100%_60%,var(--primary)_20%,transparent_22%)] opacity-80" />
          </div>
        </div>
      </Reveal>

      <section className="border-b border-slate-200 bg-[var(--site-surface-1)]">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:py-16">
          <Reveal className="mb-8">
            <p className="text-xs uppercase tracking-[0.24em] text-primary" data-tina-field={rangeKicker.field}>{rangeKicker.value}</p>
          </Reveal>

          <div className="space-y-12">
            {features.map((feature, index) => {
              const reverse = index % 2 !== 0

              return (
                <Reveal
                  key={feature.id}
                  className="grid gap-8 border-t border-slate-200 pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:pt-10"
                >
                  <div className={reverse ? "lg:order-2" : ""}>
                    <h3
                      className="max-w-lg font-display text-3xl uppercase tracking-[0.03em] text-slate-900 md:text-4xl"
                    >
                      <KeywordGradientText dataTinaField={feature.titleField} text={feature.title} />
                    </h3>
                    <p className="mt-4 max-w-xl text-slate-600" data-tina-field={feature.descriptionField}>{feature.description}</p>
                    <ul className="mt-6 space-y-2 text-xs uppercase tracking-[0.16em] text-slate-600">
                      {(feature.specs.length > 0 ? feature.specs : [feature.title.toUpperCase()])
                        .slice(0, 4)
                        .map((spec) => (
                          <li key={`${feature.id}-${spec}`} className="border-b border-slate-300 pb-2">
                            {spec}
                          </li>
                        ))}
                    </ul>
                    <QuoteAwareLink
                      className="mt-6 inline-flex rounded-sm border border-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary hover:text-primary-foreground"
                      data-tina-field={feature.ctaField}
                      href={feature.href}
                      quoteLabel={feature.ctaLabel}
                    >
                      {feature.ctaLabel}
                    </QuoteAwareLink>
                  </div>

                  <div className={reverse ? "lg:order-1" : ""}>
                    <div className={`${getGradientVariant(index + 1)} relative overflow-hidden rounded-sm border border-slate-200 p-4`}>
                      <Image
                        alt={feature.title}
                        className="h-full w-full object-cover"
                        height={780}
                        src={feature.image}
                        width={1200}
                      />

                      {feature.galleryImages.length > 0 ? (
                        <div className="mt-3 grid grid-cols-3 gap-2" data-tina-field={tinaField(page.hero, "galleryImages")}>
                          {feature.galleryImages.slice(0, 3).map((image) => (
                            <Image
                              key={`${feature.id}-${image.id}`}
                              alt={image.alt || feature.title}
                              className="h-16 w-full rounded-sm border border-slate-200 object-cover"
                              height={120}
                              src={image.src}
                              width={180}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <Reveal className="border-b border-slate-200 bg-[linear-gradient(90deg,#1a2433_0%,#1a2433_52%,#111a29_52%,#111a29_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="font-display text-3xl uppercase tracking-[0.04em] text-slate-900 md:text-4xl">
              <KeywordGradientText dataTinaField={packagesHeading.field} text={packagesHeading.value} />
            </h2>
            <p className="mt-4 max-w-xl text-slate-600" data-tina-field={packagesBody.field}>{packagesBody.value}</p>
            <QuoteAwareLink
              className="mt-7 inline-flex w-full justify-center rounded-sm border border-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary hover:text-primary-foreground sm:w-auto"
              data-tina-field={tinaField(site.header, "quoteCta")}
              forceQuoteModal
              href={quoteHref}
              quoteLabel={quoteLabel}
            >
              {quoteLabel}
            </QuoteAwareLink>
          </div>

          <div className={`${getGradientVariant(3)} rounded-sm border border-slate-200 p-6`}>
            <p className="text-xs uppercase tracking-[0.24em] text-primary" data-tina-field={packagesPanelKicker.field}>{packagesPanelKicker.value}</p>
            <p className="mt-5 text-slate-600" data-tina-field={packagesPanelBody.field}>{packagesPanelBody.value}</p>
          </div>
        </div>
      </Reveal>

      <section className="bg-[var(--site-surface-1)] py-12 md:py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal className="border-b border-slate-200 pb-6">
            <h2 className="font-display text-3xl uppercase tracking-[0.03em] text-slate-900">
              <KeywordGradientText dataTinaField={faqHeading.field} text={faqHeading.value} />
            </h2>
          </Reveal>

          <div className="mt-4 divide-y divide-white/10 border-b border-slate-200">
            {faqItems.map((item, index) => (
              <Reveal key={`${item.question}-${index}`} className="py-3" id={`product-faq-${index + 1}`}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold uppercase tracking-[0.13em] text-slate-900">
                    <span data-tina-field={item.questionField}>{item.question}</span>
                    <span className="text-lg leading-none text-primary transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-4xl text-sm text-slate-600" data-tina-field={item.answerField}>{item.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}