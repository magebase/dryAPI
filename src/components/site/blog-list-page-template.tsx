import Image from "next/image"
import { tinaField } from "tinacms/dist/react"

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

function formatPublishedDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function estimateReadTime(post: BlogPost) {
  const words: string[] = []

  const appendWords = (value: string) => {
    words.push(...value.trim().split(/\s+/).filter(Boolean))
  }

  const collectRichText = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return
    }

    const node = value as { text?: unknown; children?: unknown[] }

    if (typeof node.text === "string") {
      appendWords(node.text)
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => collectRichText(child))
    }
  }

  collectRichText(post.body)

  if (words.length === 0) {
    appendWords(post.excerpt)
  }

  return Math.max(1, Math.ceil(words.length / 220))
}

export function BlogListPageTemplate({ page, posts, site }: BlogListPageTemplateProps) {
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const productsLink = site.header.primaryLinks.find((link) => link.href === "/products")
  const heroGalleryImages = page.hero.galleryImages?.filter((image) => image.src.trim().length > 0) ?? []
  const [featuredPost, ...remainingPosts] = posts
  const featuredLabel = resolveSiteUiText(site, "blogList.featuredLabel", "Featured Insight")
  const readTimeSuffix = resolveSiteUiText(site, "blogList.readTimeSuffix", "min read")
  const featuredCtaLabel = resolveSiteUiText(site, "blogList.featuredCtaLabel", "Read Featured Article")
  const cardCtaLabel = resolveSiteUiText(site, "blogList.cardCtaLabel", "Read Article >")
  const ctaKicker = resolveSiteUiText(site, "blogList.ctaKicker", "Need Project Guidance?")
  const ctaHeading = resolveSiteUiText(site, "blogList.ctaHeading", "Talk To A Power Specialist")
  const ctaBody = resolveSiteUiText(
    site,
    "blogList.ctaBody",
    "Get practical recommendations for equipment, timing, and site rollout."
  )
  const explorePrefix = resolveSiteUiText(site, "blogList.explorePrefix", "Explore")

  return (
    <main className="overflow-x-clip bg-[#0f1a2a] pb-16 text-slate-100 md:pb-20">
      <section className="relative isolate overflow-hidden border-b border-white/10">
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
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff8b2b]" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-3xl uppercase leading-[1.05] tracking-[0.03em] text-white sm:text-4xl md:text-6xl">
            <KeywordGradientText dataTinaField={tinaField(page.hero, "heading")} text={page.hero.heading} />
          </h1>
          <p className="mt-5 max-w-2xl text-sm text-slate-300 sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {page.hero.actions.map((action, index) => (
              <QuoteAwareLink
                key={`${action.href}-${action.label}`}
                className={`inline-flex w-full justify-center rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition sm:w-auto ${
                  index === 0
                    ? "border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] hover:brightness-110"
                    : "border border-[#ff8b2b] text-[#ff8b2b] hover:bg-[#ff8b2b] hover:text-white"
                }`}
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
                <div key={image.id} className={`${getGradientVariant(0)} overflow-hidden rounded-sm border border-white/20`}>
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

      {featuredPost ? (
        <section className="mx-auto mt-10 max-w-7xl px-4">
          <Reveal
            as="article"
            className={`${getGradientVariant(1)} grid overflow-hidden rounded-md border border-white/10 md:grid-cols-[1.1fr_1fr]`}
            data-tina-field={tinaField(featuredPost)}
          >
            <Image
              alt={featuredPost.title}
              className="h-64 w-full object-cover md:h-full"
              height={760}
              src={featuredPost.coverImage}
              width={1200}
            />
            <div className="space-y-4 px-5 py-5 md:px-7 md:py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8b2b]" data-tina-field={featuredLabel.field}>{featuredLabel.value}</p>
              <h2 className="font-display text-3xl uppercase leading-[1.08] tracking-[0.03em] text-white md:text-4xl">
                <KeywordGradientText dataTinaField={tinaField(featuredPost, "title")} text={featuredPost.title} />
              </h2>
              <p className="text-sm uppercase tracking-[0.16em] text-slate-300" data-tina-field={tinaField(featuredPost, "publishedAt")}>
                {formatPublishedDate(featuredPost.publishedAt)} · {estimateReadTime(featuredPost)}{" "}
                <span data-tina-field={readTimeSuffix.field}>{readTimeSuffix.value}</span>
              </p>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                <span data-tina-field={tinaField(featuredPost.author, "name")}>{featuredPost.author.name}</span> ·{" "}
                <span data-tina-field={tinaField(featuredPost.author, "role")}>{featuredPost.author.role}</span>
              </p>
              <p className="text-sm text-slate-300 md:text-base" data-tina-field={tinaField(featuredPost, "excerpt")}>
                {featuredPost.excerpt}
              </p>
              <QuoteAwareLink
                className="inline-flex rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] transition hover:brightness-110"
                data-tina-field={tinaField(featuredPost, "slug")}
                href={`/blog/${featuredPost.slug}`}
              >
                <span data-tina-field={featuredCtaLabel.field}>{featuredCtaLabel.value}</span>
              </QuoteAwareLink>
            </div>
          </Reveal>
        </section>
      ) : null}

      <section className="mx-auto mt-10 max-w-7xl px-4 md:mt-12">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {remainingPosts.map((post, index) => (
            <Reveal
              as="article"
              key={post.slug}
              className={`${getGradientVariant(index)} overflow-hidden rounded-md border border-white/10 shadow-[0_14px_30px_rgba(0,0,0,0.25)]`}
              delay={index * 0.08}
              data-tina-field={tinaField(post)}
            >
              <Image
                alt={post.title}
                className="h-52 w-full object-cover"
                height={640}
                src={post.coverImage}
                width={960}
              />

              <div className="space-y-4 px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400" data-tina-field={tinaField(post, "publishedAt")}>
                  {formatPublishedDate(post.publishedAt)} · {estimateReadTime(post)}{" "}
                  <span data-tina-field={readTimeSuffix.field}>{readTimeSuffix.value}</span>
                </p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <span data-tina-field={tinaField(post.author, "name")}>{post.author.name}</span>
                </p>
                <h2 className="text-lg font-semibold text-white">
                  <KeywordGradientText dataTinaField={tinaField(post, "title")} text={post.title} />
                </h2>
                <p className="text-sm text-slate-300" data-tina-field={tinaField(post, "excerpt")}>{post.excerpt}</p>

                <div className="flex flex-wrap gap-2" data-tina-field={tinaField(post, "tags")}>
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={`${post.slug}-${tag}`}
                      className="rounded-sm border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <QuoteAwareLink
                  className="inline-flex text-xs font-semibold uppercase tracking-[0.15em] text-[#ff8b2b] hover:text-[#ffc18f]"
                  data-tina-field={tinaField(post, "slug")}
                  href={`/blog/${post.slug}`}
                >
                  <span data-tina-field={cardCtaLabel.field}>{cardCtaLabel.value}</span>
                </QuoteAwareLink>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {page.sections.map((section) => (
        <section key={section.id} className="mx-auto mt-12 max-w-7xl px-4">
          <Reveal as="div" className={`${getGradientVariant(2)} rounded-md border border-white/10 px-6 py-7`}>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.1em] text-white md:text-3xl">
              <KeywordGradientText dataTinaField={tinaField(section, "title")} text={section.title} />
            </h2>
            <p className="mt-3 max-w-3xl text-slate-300" data-tina-field={tinaField(section, "body")}>{section.body}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card, index) => (
                <Reveal
                  as="article"
                  key={card.id}
                  className={`${getGradientVariant(index + 1)} overflow-hidden rounded-md border border-white/10`}
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
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                      <KeywordGradientText dataTinaField={tinaField(card, "title")} text={card.title} />
                    </h3>
                    <p className="mt-3 text-sm text-slate-300" data-tina-field={tinaField(card, "description")}>
                      {card.description}
                    </p>
                    <QuoteAwareLink
                      className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-[#ff8b2b] hover:text-[#ffc18f]"
                      data-tina-field={tinaField(card, "ctaLabel")}
                      href={card.href}
                      quoteLabel={card.ctaLabel}
                    >
                      {card.ctaLabel}
                    </QuoteAwareLink>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </section>
      ))}

      <section className="mx-auto mt-12 max-w-7xl px-4">
        <Reveal className={`${getGradientVariant(3)} rounded-md border border-white/10 px-5 py-5 md:flex md:items-center md:justify-between md:gap-8 md:px-6 md:py-6`}>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#ff8b2b]" data-tina-field={ctaKicker.field}>{ctaKicker.value}</p>
            <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.06em] text-white">
              <KeywordGradientText dataTinaField={ctaHeading.field} text={ctaHeading.value} />
            </h2>
            <p className="mt-2 text-sm text-slate-300" data-tina-field={ctaBody.field}>{ctaBody.value}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
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
              data-tina-field={productsLink ? tinaField(productsLink) : undefined}
              href={productsLink?.href ?? "/products"}
            >
              <span data-tina-field={explorePrefix.field}>{explorePrefix.value}</span>{" "}
              {productsLink?.label ?? "Products"}
            </QuoteAwareLink>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
