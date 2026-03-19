import Image from "next/image"
import { tinaField } from "tinacms/dist/react"

import { ContactForm } from "@/components/site/contact-form"
import { PricingTable } from "@/components/site/pricing-table"
import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { RoutePageElements } from "@/components/site/route-page-elements"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"
import type { DeapiPricingSnapshot } from "@/types/deapi-pricing"

export function RoutePageTemplate({
  page,
  site,
  deapiPricingSnapshot,
}: {
  page: RoutePage
  site: SiteConfig
  deapiPricingSnapshot?: DeapiPricingSnapshot | null
}) {
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const productsLink = site.header.primaryLinks.find((link) => link.href === "/products")
  const productsHref = productsLink?.href ?? "/products"
  const productsLabel = productsLink?.label ?? "Product Range"
  const heroGalleryImages = page.hero.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []
  const ctaKicker = resolveSiteUiText(site, "routePage.ctaKicker", "Need Fast Advice?")
  const ctaHeading = resolveSiteUiText(site, "routePage.ctaHeading", "Get Scope And Pricing Support")
  const ctaBody = resolveSiteUiText(
    site,
    "routePage.ctaBody",
    `Speak with the ${site.brand.mark} team about the right equipment and service model for your site timeline.`
  )
  const productsPrefix = resolveSiteUiText(site, "routePage.productsPrefix", "View")
  const formHeading = resolveSiteUiText(site, "routePage.contactFormHeading", "Request Project Support")
  const formDescription = resolveSiteUiText(site, "routePage.contactFormDescription", "Share your scope and required dates.")

  return (
    <main className="text-site-strong overflow-x-clip bg-[var(--site-surface-1)] pb-16 md:pb-20" data-route-page={page.slug}>
      <section className="relative isolate overflow-hidden border-b border-slate-200" data-route-hero>
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover opacity-24"
          height={1080}
          priority
          src={page.hero.image}
          width={1920}
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,18,29,0.97),rgba(10,18,29,0.78))]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

        <Reveal as="div" className="relative mx-auto max-w-7xl px-4 py-14 md:py-20 lg:py-24">
          <p className="text-sm uppercase tracking-[0.22em] text-primary" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="text-site-inverse mt-4 max-w-3xl font-display text-4xl uppercase leading-[1.06] tracking-[0.03em] sm:text-5xl md:text-7xl">
            <KeywordGradientText dataTinaField={tinaField(page.hero, "heading")} text={page.hero.heading} />
          </h1>
          <p className="text-site-inverse-muted mt-5 max-w-2xl text-sm sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {page.hero.actions.map((action, index) => (
              <QuoteAwareLink
                key={`${page.slug}-${action.href}-${action.label}`}
                className={`inline-flex w-full justify-center rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition sm:w-auto ${
                  index === 0
                    ? "border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] text-primary-foreground shadow-lg hover:brightness-110"
                    : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                }`}
                data-tina-field={tinaField(action)}
                data-route-hero-action={String(index)}
                href={action.href}
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
                    className="h-28 w-full object-cover"
                    data-tina-field={tinaField(image, "src")}
                    height={260}
                    src={image.src}
                    width={460}
                  />
                  {image.caption ? (
                    <p className="text-site-muted px-3 py-2 text-[11px] uppercase tracking-[0.14em]" data-tina-field={tinaField(image, "caption")}>
                      {image.caption}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Reveal>
      </section>

      {page.slug === "/pricing" ? <PricingTable snapshot={deapiPricingSnapshot} /> : null}

      {page.pageContent?.elements?.length ? <RoutePageElements elements={page.pageContent.elements} /> : null}

      {page.sections.map((section) => {
        const galleryImages = section.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []

        return (
          <section
            key={section.id}
            className="border-b border-slate-200 py-10 even:bg-[var(--site-surface-1)] md:py-14"
            data-route-section={section.id}
          >
            <Reveal as="div" className="mx-auto max-w-7xl px-4">
              <h2 className="text-site-strong text-2xl font-semibold uppercase tracking-[0.12em] md:text-3xl">
                <KeywordGradientText dataTinaField={tinaField(section, "title")} text={section.title} />
              </h2>
              <p className="text-site-muted mt-3 max-w-3xl md:text-base" data-tina-field={tinaField(section, "body")}>
                {section.body}
              </p>

              {galleryImages.length > 0 ? (
                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tina-field={tinaField(section, "galleryImages")}>
                  {galleryImages.slice(0, 6).map((image) => (
                    <div key={image.id} className={`${getGradientVariant(1)} overflow-hidden rounded-sm border border-slate-200`}>
                      <Image
                        alt={image.alt || `${section.title} image`}
                        className="h-36 w-full object-cover"
                        data-tina-field={tinaField(image, "src")}
                        height={320}
                        src={image.src}
                        width={520}
                      />
                      {image.caption ? (
                        <p className="text-site-muted px-3 py-2 text-[11px] uppercase tracking-[0.14em]" data-tina-field={tinaField(image, "caption")}>
                          {image.caption}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.cards.map((card, index) => (
                  <Reveal
                    as="article"
                    className={`${getGradientVariant(index)} overflow-hidden rounded-md border border-slate-200 shadow-[0_12px_24px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:border-primary/45`}
                    delay={index * 0.08}
                    y={0}
                    key={card.id}
                    data-route-card={card.id}
                    data-tina-field={tinaField(card)}
                  >
                    {card.image ? (
                      <Image
                        alt={card.title}
                        className="h-40 w-full object-cover"
                        data-tina-field={tinaField(card, "image")}
                        height={360}
                        src={card.image}
                        width={560}
                      />
                    ) : null}
                    <div className="p-5">
                      <h3 className="text-site-strong text-sm font-semibold uppercase tracking-[0.16em]">
                        <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                      </h3>
                      <p className="text-site-muted mt-3 text-sm" data-tina-field={tinaField(card, "description")}>
                        {card.description}
                      </p>
                      <QuoteAwareLink
                        className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-primary"
                        data-route-card-cta={card.id}
                        data-tina-field={tinaField(card, "ctaLabel")}
                        href={card.href}
                      >
                        {card.ctaLabel}
                      </QuoteAwareLink>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
          </section>
        )
      })}

      <Reveal as="section" className="mx-auto mt-10 max-w-7xl px-4 md:mt-14">
        <div className={`${getGradientVariant(2)} rounded-md border border-slate-200 px-6 py-6 md:flex md:items-center md:justify-between md:gap-8`}>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary" data-tina-field={ctaKicker.field}>{ctaKicker.value}</p>
            <h2 className="text-site-strong mt-2 font-display text-2xl uppercase tracking-[0.06em]">
              <KeywordGradientText dataTinaField={ctaHeading.field} text={ctaHeading.value} />
            </h2>
            <p className="text-site-muted mt-2 text-sm md:text-base" data-tina-field={ctaBody.field}>{ctaBody.value}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
            <QuoteAwareLink
              className="inline-flex w-full justify-center rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition hover:brightness-110 sm:w-auto"
              data-tina-field={tinaField(site.header, "quoteCta")}
              href={quoteHref}
            >
              {quoteLabel}
            </QuoteAwareLink>
            <QuoteAwareLink
              className="text-site-muted inline-flex w-full justify-center rounded-sm border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary/40 hover:text-[color:var(--site-text-strong)] sm:w-auto"
              data-tina-field={productsLink ? tinaField(productsLink) : undefined}
              href={productsHref}
            >
              {productsPrefix.value} {productsLabel}
            </QuoteAwareLink>
          </div>
        </div>
      </Reveal>

      {page.contactPanel ? (
        <section className="mx-auto mt-12 grid max-w-7xl gap-6 px-4 lg:mt-14 lg:grid-cols-2 lg:gap-8">
          <Reveal as="div" className={`${getGradientVariant(3)} rounded-md border border-slate-200 p-6`}>
            <h3 className="text-site-strong text-2xl font-semibold uppercase tracking-[0.08em]">
              <KeywordGradientText dataTinaField={tinaField(page.contactPanel, "heading")} text={page.contactPanel.heading} />
            </h3>
            <p className="text-site-muted mt-3" data-tina-field={tinaField(page.contactPanel, "body")}>{page.contactPanel.body}</p>
            <p className="mt-3 text-sm uppercase tracking-[0.15em] text-primary" data-tina-field={tinaField(page.contactPanel, "responseTime")}>
              {page.contactPanel.responseTime}
            </p>
          </Reveal>
          <Reveal as="div" className={`${getGradientVariant(4)} rounded-md border border-slate-200 p-6`} delay={0.1}>
            <ContactForm
              description={formDescription.value}
              descriptionField={formDescription.field}
              heading={formHeading.value}
              headingField={formHeading.field}
              responseTime={page.contactPanel.responseTime}
              site={site}
            />
          </Reveal>
        </section>
      ) : null}
    </main>
  )
}
