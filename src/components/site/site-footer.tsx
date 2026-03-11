import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { Reveal } from "@/components/site/reveal"
import type { SiteConfig } from "@/lib/site-content-schema"

const iconMap = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

export function SiteFooter({ site }: { site: SiteConfig }) {
  const quickContactHref = site.footer.contactLinks[0]?.href ?? "/contact"
  const quickContactFallback = resolveSiteUiText(site, "footer.quickContactFallback", "Talk To Team")
  const quickContactLabel = site.footer.contactLinks[0]?.label ?? quickContactFallback.value
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const supportPrompt = resolveSiteUiText(
    site,
    "footer.supportPrompt",
    "Need Fast Project Pricing Or Deployment Support?"
  )

  return (
    <footer className="relative border-t border-white/10 bg-[color:var(--site-surface-0)]">

      <div className="relative border-b border-white/10">
        <div
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5"
          data-aos="fade-up"
          data-aos-delay="30"
          data-aos-duration="420"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100" data-tina-field={supportPrompt.field}>{supportPrompt.value}</p>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
              forceQuoteModal
              href={quoteHref}
              quoteLabel={quoteLabel}
            >
              {quoteLabel}
            </QuoteAwareLink>
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center rounded-sm border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:border-white hover:text-white"
              data-tina-field={tinaField(site.footer, "contactLinks")}
              href={quickContactHref}
            >
              {quickContactLabel}
            </QuoteAwareLink>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.3fr_2fr]">
        <Reveal as="div" className="space-y-5">
          <p className="font-display text-3xl tracking-[0.28em] text-white" data-tina-field={tinaField(site.brand, "mark")}>
            {site.brand.mark}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-[color:var(--site-text-soft)]" data-tina-field={tinaField(site.footer, "companyText")}>
            {site.footer.companyText}
          </p>
          <div className="space-y-2 text-sm text-[color:var(--site-text-muted)]">
            {site.footer.contactLinks.map((item, index) => (
              <p key={`contact-${item.href}-${item.label}-${index}`} data-tina-field={tinaField(item)}>
                <QuoteAwareLink className="transition hover:text-white" href={item.href}>
                  {item.label}
                </QuoteAwareLink>
              </p>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {site.footer.socialLinks.map((item, index) => {
              const Icon = iconMap[item.icon]

              return (
                <QuoteAwareLink
                  key={`social-${item.href}-${item.label}-${index}`}
                  aria-label={item.label}
                  className="rounded-sm border border-white/20 p-2 text-slate-300 transition hover:border-[#ff8b2b] hover:text-[#ff8b2b]"
                  data-tina-field={tinaField(item)}
                  href={item.href}
                >
                  <Icon className="size-4" />
                </QuoteAwareLink>
              )
            })}
          </div>
        </Reveal>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {site.footer.columns.map((column, columnIndex) => (
            <Reveal
              as="div"
              key={`column-${column.title}-${columnIndex}`}
              delay={columnIndex * 0.08}
            >
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
                <span data-tina-field={tinaField(column, "title")}>{column.title}</span>
              </h3>
              <ul className="space-y-2 text-sm text-[color:var(--site-text-soft)]">
                {column.links.map((link, linkIndex) => (
                  <li key={`column-link-${column.title}-${link.href}-${link.label}-${linkIndex}`} data-tina-field={tinaField(link)}>
                    <QuoteAwareLink className="transition hover:text-white" href={link.href}>
                      {link.label}
                    </QuoteAwareLink>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 text-xs text-slate-400">
          {site.footer.legalLinks.map((link, index) => (
            <QuoteAwareLink
              key={`legal-${link.href}-${link.label}-${index}`}
              className="transition hover:text-white"
              data-aos="fade-up"
              data-aos-delay={String(index * 45)}
              data-aos-duration="360"
              data-tina-field={tinaField(link)}
              href={link.href}
            >
              {link.label}
            </QuoteAwareLink>
          ))}
        </div>
      </div>
    </footer>
  )
}
