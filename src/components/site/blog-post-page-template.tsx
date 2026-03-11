import Image from "next/image"
import { tinaField } from "tinacms/dist/react"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { getGradientVariant } from "@/components/site/gradient-variants"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

type BlogPostPageTemplateProps = {
  post: BlogPost
  site: SiteConfig
}

function formatPublishedDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function BlogPostPageTemplate({ post, site }: BlogPostPageTemplateProps) {
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const resourcesLink = site.header.primaryLinks.find((link) => link.href === "/resources")

  return (
    <main className="overflow-x-clip bg-[#0f1a2a] pb-16 text-slate-100 md:pb-20">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <Image
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          height={1080}
          priority
          src={post.coverImage}
          width={1920}
        />
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(7,15,24,0.93),rgba(7,15,24,0.82),rgba(7,15,24,0.94))]" />
        <div className="absolute inset-0 opacity-28 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px]" />

        <Reveal className="relative mx-auto max-w-4xl px-4 pb-12 pt-20 md:pb-14 md:pt-24 lg:pb-20 lg:pt-28">
          <QuoteAwareLink
            className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-[#ff8b2b] hover:text-[#ffc18f]"
            href="/blog"
          >
            Back To Blog
          </QuoteAwareLink>
          <h1 className="mt-4 font-display text-3xl uppercase leading-[1.06] tracking-[0.03em] text-white sm:text-4xl md:text-6xl">
            <KeywordGradientText dataTinaField={tinaField(post, "title")} text={post.title} />
          </h1>
          <p className="mt-4 text-sm text-slate-300 sm:text-base md:text-lg" data-tina-field={tinaField(post, "excerpt")}>
            {post.excerpt}
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.16em] text-slate-300">
            <span data-tina-field={tinaField(post, "publishedAt")}>{formatPublishedDate(post.publishedAt)}</span> ·{" "}
            <span data-tina-field={tinaField(post.author, "name")}>{post.author.name}</span> ·{" "}
            <span data-tina-field={tinaField(post.author, "role")}>{post.author.role}</span>
          </p>
        </Reveal>
      </section>

      <article className="mx-auto mt-8 max-w-4xl space-y-5 px-4 md:mt-10 md:space-y-8">
        {post.sections.map((section, index) => (
          <Reveal
            as="section"
            key={section.id}
            className={`${getGradientVariant(index)} rounded-md border border-white/10 px-5 py-5 md:px-6 md:py-6`}
            delay={index * 0.08}
            data-tina-field={tinaField(section)}
          >
            <h2 className="text-xl font-semibold text-white">
              <KeywordGradientText dataTinaField={tinaField(section, "heading")} text={section.heading} />
            </h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-300" data-tina-field={tinaField(section, "body")}>
              {section.body}
            </p>
          </Reveal>
        ))}
      </article>

      <Reveal as="section" className={`${getGradientVariant(3)} mx-auto mt-10 max-w-4xl rounded-md border border-white/10 px-5 py-5 md:mt-12 md:px-6 md:py-6`}>
        <p className="text-xs uppercase tracking-[0.18em] text-[#ff8b2b]">Next Step</p>
        <h2 className="mt-2 text-lg font-semibold uppercase tracking-[0.14em] text-white">
          <KeywordGradientText text="Need Help On Your Site?" />
        </h2>
        <p className="mt-3 text-slate-300">
          Talk to the {site.brand.mark} team for practical guidance on temporary power strategy, deployment, and support.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <QuoteAwareLink
            className="inline-flex w-full justify-center rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] transition hover:brightness-110 sm:w-auto"
            data-tina-field={tinaField(site.header, "quoteCta")}
            forceQuoteModal
            href={quoteHref}
            quoteLabel={quoteLabel}
          >
            {quoteLabel}
          </QuoteAwareLink>
          <QuoteAwareLink
            className="inline-flex w-full justify-center rounded-sm border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:border-white hover:text-white sm:w-auto"
            data-tina-field={resourcesLink ? tinaField(resourcesLink) : undefined}
            href={resourcesLink?.href ?? "/resources"}
          >
            View {resourcesLink?.label ?? "Resources"}
          </QuoteAwareLink>
        </div>
      </Reveal>
    </main>
  )
}
