import Image from "next/image"
import { ChevronDown, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { ContactPageForm } from "@/components/site/contact-page-form"
import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"

type ContactPageTemplateProps = {
  page: RoutePage
  site: SiteConfig
}

const socialIconMap = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

export function ContactPageTemplate({ page, site }: ContactPageTemplateProps) {
  const contactPanelHeading = page.contactPanel?.heading ?? site.header.quoteCta.label
  const heroGalleryImages = page.hero.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []
  const locationCards = page.sections.flatMap((section) => section.cards)
  const locationFallbackLabel = resolveSiteUiText(site, "contactPage.locationFallbackLabel", site.header.quoteCta.label)
  const locationFallback = site.footer.columns
    .find((column) => column.title.toLowerCase().includes("location"))
    ?.links.map((link, index) => ({
      id: `location-fallback-${index}`,
      title: link.label,
      description: page.hero.body,
      href: link.href,
      ctaLabel: locationFallbackLabel.value,
    }))

  const locations = locationCards.length > 0 ? locationCards : locationFallback ?? []
  const urgentKicker = resolveSiteUiText(site, "contactPage.urgentKicker", page.hero.kicker)
  const urgentHeading = resolveSiteUiText(site, "contactPage.urgentHeading", page.contactPanel?.heading ?? site.header.phone.label)
  const urgentBody = resolveSiteUiText(
    site,
    "contactPage.urgentBody",
    page.contactPanel?.body ?? "For critical jobs and shutdown timelines, direct phone contact is the fastest path."
  )
  const locationsHeading = resolveSiteUiText(site, "contactPage.locationsHeading", "Our Locations")
  const locationsSubheading = resolveSiteUiText(site, "contactPage.locationsSubheading", site.announcement)

  return (
    <main className="overflow-x-clip bg-[#0d1623]">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover grayscale"
          height={1080}
          priority
          src={page.hero.image}
          width={1920}
        />
        <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(10,18,29,0.97),rgba(10,18,29,0.72),rgba(10,18,29,0.58))]" />
        <div className="absolute inset-0 opacity-26 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute -right-10 top-10 hidden h-72 w-72 rotate-12 border-[22px] border-primary/55 md:block" />
        <div className="absolute -right-4 top-28 hidden h-56 w-56 rotate-12 border-[18px] border-accent/65 md:block" />

        <Reveal as="div" className="relative mx-auto max-w-7xl px-4 py-16 md:py-24 lg:py-28">
          <div className="max-w-xl bg-black/28 p-6 backdrop-blur-[1px] md:p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-primary" data-tina-field={tinaField(page.hero, "kicker")}>
              {page.hero.kicker}
            </p>
            <h1 className="mt-4 font-display text-3xl uppercase tracking-[0.06em] text-white sm:text-4xl md:text-6xl">
              <KeywordGradientText dataTinaField={tinaField(page.hero, "heading")} text={page.hero.heading} />
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-200 md:text-base" data-tina-field={tinaField(page.hero, "body")}>
              {page.hero.body}
            </p>

            {heroGalleryImages.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2" data-tina-field={tinaField(page.hero, "galleryImages")}>
                {heroGalleryImages.slice(0, 4).map((image) => (
                    <div key={image.id} className={`${getGradientVariant(0)} overflow-hidden rounded-sm border border-white/20`}>
                    <Image
                      alt={image.alt || `${page.hero.heading} gallery image`}
                      className="h-24 w-full object-cover"
                      data-tina-field={tinaField(image, "src")}
                      height={240}
                      src={image.src}
                      width={400}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Reveal>
      </section>

      <section className="border-b border-white/10 bg-[linear-gradient(90deg,#0d1724,#111f30)] py-12 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 lg:grid-cols-[0.95fr_1.15fr] lg:items-start">
          <Reveal as="div" className={`${getGradientVariant(1)} rounded-sm border border-white/10 p-6 md:p-8`}>
            <h2
              className="font-display text-3xl uppercase tracking-[0.06em] text-white"
            >
              <KeywordGradientText
                dataTinaField={page.contactPanel ? tinaField(page.contactPanel, "heading") : undefined}
                text={contactPanelHeading}
              />
            </h2>
            <p
              className="mt-3 text-sm leading-relaxed text-slate-300"
              data-tina-field={page.contactPanel ? tinaField(page.contactPanel, "body") : undefined}
            >
              {page.contactPanel?.body}
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-200">
              {site.footer.contactLinks.map((item) => {
                const isPhone = item.href.startsWith("tel:")
                const isEmail = item.href.startsWith("mailto:")
                const Icon = isPhone ? Phone : isEmail ? Mail : MapPin

                return (
                  <QuoteAwareLink
                    key={item.href}
                    className="flex items-start gap-3 transition hover:text-white"
                    data-tina-field={tinaField(item)}
                    href={item.href}
                  >
                    <Icon className="mt-0.5 size-4 text-primary" />
                    <span>{item.label}</span>
                  </QuoteAwareLink>
                )
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {site.footer.socialLinks.map((item) => {
                const Icon = socialIconMap[item.icon]

                return (
                  <QuoteAwareLink
                    key={item.href}
                    aria-label={item.label}
                    className="rounded-sm border border-white/20 p-2 text-slate-300 transition hover:border-primary hover:text-primary"
                    data-tina-field={tinaField(item)}
                    href={item.href}
                  >
                    <Icon className="size-4" />
                  </QuoteAwareLink>
                )
              })}
            </div>
          </Reveal>

          <Reveal as="div" className="rounded-md border border-slate-300/30 bg-slate-100 p-5 md:p-7" delay={0.1}>
            <ContactPageForm
              responseTime={page.contactPanel?.responseTime ?? "Typical response within one business day"}
              site={site}
            />
          </Reveal>
        </div>
      </section>

      <section className="bg-[#262f3d] py-12 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal as="div" className={`${getGradientVariant(3)} rounded-md border border-white/10 p-6`}>
            <p className="text-xs uppercase tracking-[0.2em] text-primary" data-tina-field={urgentKicker.field}>{urgentKicker.value}</p>
            <h2 className="mt-3 font-display text-2xl uppercase tracking-[0.06em] text-white">
              <KeywordGradientText dataTinaField={urgentHeading.field} text={urgentHeading.value} />
            </h2>
            <p className="mt-3 text-sm text-slate-300" data-tina-field={urgentBody.field}>{urgentBody.value}</p>
            <QuoteAwareLink
              className="mt-5 inline-flex w-full justify-center rounded-sm border border-primary bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:bg-primary hover:text-primary-foreground sm:w-auto"
              data-tina-field={tinaField(site.header, "phone")}
              href={site.header.phone.href}
            >
              {site.header.phone.label}
            </QuoteAwareLink>
          </Reveal>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-100" data-tina-field={locationsHeading.field}>{locationsHeading.value}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300" data-tina-field={locationsSubheading.field}>{locationsSubheading.value}</p>

            <div className="mt-7 divide-y divide-white/20 border-b border-t border-white/20">
                      {locations.map((location, index) => {
                        const locationImage = "image" in location && typeof location.image === "string" ? location.image : null

                        return (
                          <Reveal
                            as="div"
                            key={location.id}
                            className="py-3"
                            delay={index * 0.08}
                            revealKey={`contact-location-${location.id}`}
                            data-tina-field={tinaField(location)}
                          >
                            <details className="group text-slate-200">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold uppercase tracking-[0.14em]">
                                <KeywordGradientText dataTinaField={tinaField(location, "title")} text={location.title} />
                                <ChevronDown className="size-4 text-primary transition group-open:rotate-180" />
                              </summary>
                              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300" data-tina-field={tinaField(location, "description")}>
                                {location.description}
                              </p>
                              {locationImage ? (
                                <Image
                                  alt={location.title}
                                  className="mt-3 h-32 w-full max-w-xl rounded-sm border border-white/15 object-cover"
                                  height={280}
                                  src={locationImage}
                                  width={560}
                                />
                              ) : null}
                              <QuoteAwareLink
                                className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.13em] text-primary"
                                data-tina-field={tinaField(location, "ctaLabel")}
                                href={location.href}
                                quoteLabel={location.ctaLabel}
                              >
                                {location.ctaLabel}
                              </QuoteAwareLink>
                            </details>
                          </Reveal>
                        )
                      })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
