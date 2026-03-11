import Image from "next/image"
import { ArticleJsonLd } from "next-seo"
import { tinaField } from "tinacms/dist/react"
import { TinaMarkdown } from "tinacms/dist/rich-text"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

type TinaMarkdownContentLike = Parameters<typeof TinaMarkdown>[0]["content"]

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

function normalizeCanonicalPath(slug: string, canonicalPath: string | undefined) {
  const raw = canonicalPath?.trim()
  if (!raw) {
    return `/blog/${slug}`
  }

  return raw.startsWith("/") ? raw : `/${raw}`
}

function toJsonLdDate(value: string): string | undefined {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

function getAuthorInitials(name: string) {
  const letters = name
    .split(/\s+/)
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return letters || "GF"
}

export function BlogPostPageTemplate({ post, site }: BlogPostPageTemplateProps) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://genfix.com.au").replace(/\/+$/, "")
  const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath)
  const canonicalUrl = `${siteUrl}${canonicalPath}`
  const publishedIso = toJsonLdDate(post.publishedAt)
  const articleImage = post.ogImage?.trim() || post.coverImage
  const quoteHref = site.header.quoteCta.href
  const quoteLabel = site.header.quoteCta.label
  const blogLink = site.header.primaryLinks.find((link) => link.href === "/blog")
  const resourcesLink = site.header.primaryLinks.find((link) => link.href === "/resources")

  const backToBlog = resolveSiteUiText(site, "blogPost.backToBlog", blogLink?.label ?? "Back To Blog")
  const nextStepKicker = resolveSiteUiText(site, "blogPost.nextStepKicker", "Next Step")
  const nextStepHeading = resolveSiteUiText(site, "blogPost.nextStepHeading", "Need Help On Your Site?")
  const nextStepBody = resolveSiteUiText(
    site,
    "blogPost.nextStepBody",
    `Talk to the ${site.brand.mark} team for practical guidance on temporary power strategy, deployment, and support.`
  )
  const resourcesPrefix = resolveSiteUiText(site, "blogPost.resourcesPrefix", "View")

  return (
    <main className="overflow-x-clip bg-[#0f1a2a] pb-16 text-slate-100 md:pb-20">
      <ArticleJsonLd
        author={{
          "@type": "Person",
          name: post.author.name,
        }}
        description={post.seoDescription}
        headline={post.title}
        image={[articleImage]}
        mainEntityOfPage={{
          "@type": "WebPage",
          "@id": canonicalUrl,
        }}
        publisher={{
          "@type": "Organization",
          name: site.brand.mark,
        }}
        scriptId={`blog-post-jsonld-${post.slug}`}
        type="BlogPosting"
        url={canonicalUrl}
        {...(publishedIso ? { datePublished: publishedIso } : {})}
      />
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
            data-tina-field={backToBlog.field}
          >
            {backToBlog.value}
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

      <Reveal as="article" className="mx-auto mt-8 max-w-3xl px-4 md:mt-10">
        <div className="rounded-md border border-white/10 bg-[#101f31]/70 px-5 py-6 md:px-8 md:py-8">
          <div className="prose prose-invert max-w-none prose-p:text-slate-200 prose-li:text-slate-200 prose-headings:text-white prose-a:text-[#ffbf8a]" data-tina-field={tinaField(post, "body")}>
            <TinaMarkdown content={post.body as TinaMarkdownContentLike} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto mt-8 max-w-3xl px-4">
        <div className="rounded-md border border-white/10 bg-[#101f31]/55 px-5 py-5 md:px-8">
          <div className="flex items-start gap-4" data-tina-field={tinaField(post, "author")}>
            {post.author.avatar ? (
              <Image
                alt={post.author.name}
                className="h-14 w-14 rounded-full border border-white/15 object-cover"
                data-tina-field={tinaField(post.author, "avatar")}
                height={56}
                src={post.author.avatar}
                width={56}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#16283d] text-sm font-semibold uppercase text-[#ffbf8a]">
                {getAuthorInitials(post.author.name)}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#ff8b2b]">Author</p>
              <p className="mt-1 text-base font-semibold text-white" data-tina-field={tinaField(post.author, "name")}>
                {post.author.name}
              </p>
              <p className="text-sm text-slate-300" data-tina-field={tinaField(post.author, "role")}>
                {post.author.role}
              </p>
              {post.author.bio ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-200" data-tina-field={tinaField(post.author, "bio")}>
                  {post.author.bio}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto mt-10 max-w-3xl rounded-md border border-white/10 bg-[#16283d] px-5 py-5 md:mt-12 md:px-6 md:py-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[#ff8b2b]" data-tina-field={nextStepKicker.field}>{nextStepKicker.value}</p>
        <h2 className="mt-2 text-lg font-semibold uppercase tracking-[0.14em] text-white">
          <KeywordGradientText dataTinaField={nextStepHeading.field} text={nextStepHeading.value} />
        </h2>
        <p className="mt-3 text-slate-300" data-tina-field={nextStepBody.field}>{nextStepBody.value}</p>
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
            <span data-tina-field={resourcesPrefix.field}>{resourcesPrefix.value}</span>{" "}
            {resourcesLink?.label ?? "Resources"}
          </QuoteAwareLink>
        </div>
      </Reveal>
    </main>
  )
}
