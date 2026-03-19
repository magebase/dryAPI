import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { tinaField } from "tinacms/dist/react";

import { BrandLogo } from "@/components/site/brand-logo";
import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import { Reveal } from "@/components/site/reveal";
import type { SiteConfig } from "@/lib/site-content-schema";

const iconMap = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

export function SiteFooter({ site }: { site: SiteConfig }) {
  const quickContactHref = site.footer.contactLinks[0]?.href ?? "/contact";
  const quickContactFallback = resolveSiteUiText(
    site,
    "footer.quickContactFallback",
    "Talk To Team",
  );
  const quickContactLabel =
    site.footer.contactLinks[0]?.label ?? quickContactFallback.value;
  const quoteHref = site.header.quoteCta.href;
  const quoteLabel = site.header.quoteCta.label;
  const supportPrompt = resolveSiteUiText(
    site,
    "footer.supportPrompt",
    "Need Fast Project Pricing Or Deployment Support?",
  );

  return (
    <footer className="relative border-t border-[color:var(--border)] bg-[var(--site-surface-0)]">
      <div className="relative border-b border-[color:var(--border)] bg-[color:var(--site-surface-1)]/55">
        <div
          className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          data-aos="fade-up"
          data-aos-delay="30"
          data-aos-duration="420"
        >
          <p
            className="text-site-strong max-w-3xl text-xs font-semibold uppercase tracking-[0.16em]"
            data-tina-field={supportPrompt.field}
          >
            {supportPrompt.value}
          </p>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 sm:gap-3">
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center rounded-md border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
              forceQuoteModal
              href={quoteHref}
              quoteLabel={quoteLabel}
            >
              {quoteLabel}
            </QuoteAwareLink>
            <QuoteAwareLink
              className="inline-flex w-full items-center justify-center rounded-md border border-[color:var(--border)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-site-muted transition hover:border-primary/45 hover:text-[color:var(--site-text-strong)]"
              data-tina-field={tinaField(site.footer, "contactLinks")}
              href={quickContactHref}
            >
              {quickContactLabel}
            </QuoteAwareLink>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-x-14 gap-y-12 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)]">
        <Reveal as="div" className="space-y-5">
          <BrandLogo
            mark={site.brand.mark}
            markDataTinaField={tinaField(site.brand, "mark")}
            name={site.brand.name}
            nameClassName="text-[11px]"
            nameDataTinaField={tinaField(site.brand, "name")}
            size="lg"
            tone="dark"
          />
          <p
            className="max-w-sm text-sm leading-relaxed text-[color:var(--site-text-soft)]"
            data-tina-field={tinaField(site.footer, "companyText")}
          >
            {site.footer.companyText}
          </p>
          <div className="space-y-2 text-sm text-[color:var(--site-text-muted)]">
            {site.footer.contactLinks.map((item, index) => (
              <p
                key={`contact-${item.href}-${item.label}-${index}`}
                data-tina-field={tinaField(item)}
              >
                <QuoteAwareLink
                  className="transition hover:text-[color:var(--site-text-strong)]"
                  href={item.href}
                >
                  {item.label}
                </QuoteAwareLink>
              </p>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {site.footer.socialLinks.map((item, index) => {
              const Icon = iconMap[item.icon];

              return (
                <QuoteAwareLink
                  key={`social-${item.href}-${item.label}-${index}`}
                  aria-label={item.label}
                  className="rounded-sm border border-[color:var(--border)] p-2 text-site-muted transition hover:border-primary hover:text-primary"
                  data-tina-field={tinaField(item)}
                  href={item.href}
                >
                  <Icon className="size-4" />
                </QuoteAwareLink>
              );
            })}
          </div>
        </Reveal>

        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {site.footer.columns.map((column, columnIndex) => (
            <Reveal
              as="div"
              key={`column-${column.title}-${columnIndex}`}
              delay={columnIndex * 0.08}
            >
              <h3 className="text-site-strong mb-4 text-xs font-semibold uppercase tracking-[0.18em]">
                <span data-tina-field={tinaField(column, "title")}>
                  {column.title}
                </span>
              </h3>
              <ul className="space-y-2.5 text-sm leading-6 text-[color:var(--site-text-soft)]">
                {column.links.map((link, linkIndex) => (
                  <li
                    key={`column-link-${column.title}-${link.href}-${link.label}-${linkIndex}`}
                    data-tina-field={tinaField(link)}
                  >
                    <QuoteAwareLink
                      className="transition hover:text-[color:var(--site-text-strong)]"
                      href={link.href}
                    >
                      {link.label}
                    </QuoteAwareLink>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="border-t border-[color:var(--border)] py-4">
        <div className="text-site-soft mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 text-xs">
          {site.footer.legalLinks.map((link, index) => (
            <QuoteAwareLink
              key={`legal-${link.href}-${link.label}-${index}`}
              className="transition hover:text-[color:var(--site-text-strong)]"
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
  );
}
