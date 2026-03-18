"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ArrowRight, BookText, Filter, Sparkles } from "lucide-react"
import { tinaField } from "tinacms/dist/react"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import { getGradientVariant } from "@/components/site/gradient-variants"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  buildBlogTakumiCoverImage,
  collectBlogFilterTags,
  getPaginationItems,
  isTakumiImageUrl,
  sortBlogPosts,
  type BlogSortOrder,
} from "@/lib/blog-article-catalog"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

type BlogArticleCatalogProps = {
  posts: BlogPost[]
  site: SiteConfig
}

const POSTS_PER_PAGE = 12
const DEFAULT_TAG_FILTER = "__all__"

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

type TakumiBlogCoverImageProps = {
  post: BlogPost
  className: string
  width: number
  height: number
  priority?: boolean
}

function TakumiBlogCoverImage({ post, className, width, height, priority = false }: TakumiBlogCoverImageProps) {
  const generatedTakumiUrl = useMemo(() => buildBlogTakumiCoverImage(post), [post])
  const hasTakumiCoverInPayload = isTakumiImageUrl(post.ogImage)
  const [resolvedSrc, setResolvedSrc] = useState<string>(
    hasTakumiCoverInPayload ? post.ogImage ?? generatedTakumiUrl : post.coverImage
  )
  const [isWaitingForGeneratedCover, setIsWaitingForGeneratedCover] = useState<boolean>(!hasTakumiCoverInPayload)

  useEffect(() => {
    if (hasTakumiCoverInPayload) {
      setResolvedSrc(post.ogImage ?? generatedTakumiUrl)
      setIsWaitingForGeneratedCover(false)
      return
    }

    setResolvedSrc(post.coverImage)
    setIsWaitingForGeneratedCover(true)

    let isDisposed = false
    let retryCount = 0
    const maxRetries = 4

    const requestGeneratedCover = () => {
      const imageProbe = new window.Image()

      imageProbe.onload = () => {
        if (isDisposed) {
          return
        }

        setResolvedSrc(generatedTakumiUrl)
        setIsWaitingForGeneratedCover(false)
      }

      imageProbe.onerror = () => {
        if (isDisposed) {
          return
        }

        if (retryCount >= maxRetries) {
          setIsWaitingForGeneratedCover(false)
          return
        }

        retryCount += 1
        const retryDelay = Math.min(1000 * retryCount, 3000)
        window.setTimeout(requestGeneratedCover, retryDelay)
      }

      // Trigger the OG worker in the background when a post payload does not already include a Takumi image.
      imageProbe.src = retryCount > 0 ? `${generatedTakumiUrl}&refresh=1` : generatedTakumiUrl
    }

    requestGeneratedCover()

    return () => {
      isDisposed = true
    }
  }, [generatedTakumiUrl, hasTakumiCoverInPayload, post.coverImage, post.ogImage])

  return (
    <div className="relative">
      <Image
        alt={post.title}
        className={className}
        height={height}
        priority={priority}
        src={resolvedSrc}
        width={width}
        onError={() => {
          if (resolvedSrc !== post.coverImage) {
            setResolvedSrc(post.coverImage)
          }
        }}
      />
      {isWaitingForGeneratedCover ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-[rgba(0,0,0,0.62)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          <Sparkles className="size-3" />
          Generating OG Cover
        </span>
      ) : null}
    </div>
  )
}

type BlogArticleControlsProps = {
  selectedSortOrder: BlogSortOrder
  selectedTag: string
  tagOptions: string[]
  totalArticles: number
  filteredArticles: number
  onSortOrderChange: (value: BlogSortOrder) => void
  onTagChange: (value: string) => void
}

function BlogArticleControls({
  selectedSortOrder,
  selectedTag,
  tagOptions,
  totalArticles,
  filteredArticles,
  onSortOrderChange,
  onTagChange,
}: BlogArticleControlsProps) {
  const countLabel = filteredArticles === totalArticles ? `${totalArticles} articles` : `${filteredArticles} of ${totalArticles} articles`

  return (
    <section className="mx-auto mt-10 max-w-7xl px-4 md:mt-12" id="blog-article-controls">
      <Reveal className={`${getGradientVariant(1)} rounded-md border border-slate-200 p-4 md:p-5`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Filter className="size-3.5" />
              Articles
            </p>
            <p className="mt-2 text-sm text-slate-600">Sort and filter the archive, then browse with pagination.</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{countLabel}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:min-w-[420px]">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="blog-sort-order">
              Sort
              <select
                className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                id="blog-sort-order"
                value={selectedSortOrder}
                onChange={(event) => onSortOrderChange(event.target.value as BlogSortOrder)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="blog-tag-filter">
              Filter
              <select
                className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                id="blog-tag-filter"
                value={selectedTag}
                onChange={(event) => onTagChange(event.target.value)}
              >
                <option value={DEFAULT_TAG_FILTER}>All topics</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function BlogArticleCatalog({ posts, site }: BlogArticleCatalogProps) {
  const [sortOrder, setSortOrder] = useState<BlogSortOrder>("newest")
  const [tagFilter, setTagFilter] = useState<string>(DEFAULT_TAG_FILTER)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const featuredLabel = resolveSiteUiText(site, "blogList.featuredLabel", "Featured Insight")
  const readTimeSuffix = resolveSiteUiText(site, "blogList.readTimeSuffix", "min read")
  const featuredCtaLabel = resolveSiteUiText(site, "blogList.featuredCtaLabel", "Read Featured Article")
  const cardCtaLabel = resolveSiteUiText(site, "blogList.cardCtaLabel", "Read Article >")

  const tagOptions = useMemo(() => collectBlogFilterTags(posts), [posts])

  const filteredAndSortedPosts = useMemo(() => {
    const filteredPosts =
      tagFilter === DEFAULT_TAG_FILTER
        ? posts
        : posts.filter((post) => post.tags.some((tag) => tag.trim() === tagFilter))

    return sortBlogPosts(filteredPosts, sortOrder)
  }, [posts, sortOrder, tagFilter])

  const featuredPost = filteredAndSortedPosts[0] ?? null
  const remainingPosts = featuredPost ? filteredAndSortedPosts.slice(1) : []
  const totalPages = Math.max(1, Math.ceil(remainingPosts.length / POSTS_PER_PAGE))

  useEffect(() => {
    setCurrentPage(1)
  }, [sortOrder, tagFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE
    return remainingPosts.slice(startIndex, startIndex + POSTS_PER_PAGE)
  }, [currentPage, remainingPosts])

  const paginationItems = useMemo(() => getPaginationItems(totalPages, currentPage), [currentPage, totalPages])

  const hasResults = filteredAndSortedPosts.length > 0
  const showFeatured = Boolean(featuredPost) && currentPage === 1

  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages || pageNumber === currentPage) {
      return
    }

    setCurrentPage(pageNumber)

    if (typeof document !== "undefined") {
      document.getElementById("blog-article-controls")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <>
      <BlogArticleControls
        filteredArticles={filteredAndSortedPosts.length}
        selectedSortOrder={sortOrder}
        selectedTag={tagFilter}
        tagOptions={tagOptions}
        totalArticles={posts.length}
        onSortOrderChange={(value) => setSortOrder(value)}
        onTagChange={(value) => setTagFilter(value)}
      />

      {showFeatured && featuredPost ? (
        <section className="mx-auto mt-6 max-w-7xl px-4" id="blog-articles">
          <Reveal
            as="article"
            className={`${getGradientVariant(2)} grid overflow-hidden rounded-md border border-slate-200 md:grid-cols-[1.1fr_1fr]`}
            data-tina-field={tinaField(featuredPost)}
          >
            <TakumiBlogCoverImage
              className="h-64 w-full object-cover md:h-full"
              height={760}
              post={featuredPost}
              priority
              width={1200}
            />
            <div className="space-y-4 px-5 py-5 md:px-7 md:py-7">
              <p
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
                data-tina-field={featuredLabel.field}
              >
                <BookText className="size-3.5" />
                <span>{featuredLabel.value}</span>
              </p>
              <h2 className="font-display text-3xl uppercase leading-[1.08] tracking-[0.03em] text-slate-900 md:text-4xl">
                <KeywordGradientText dataTinaField={tinaField(featuredPost, "title")} text={featuredPost.title} />
              </h2>
              <p
                className="inline-flex items-center gap-1.5 text-sm uppercase tracking-[0.16em] text-slate-600"
                data-tina-field={tinaField(featuredPost, "publishedAt")}
              >
                <BookText className="size-4" />
                <span>
                  {formatPublishedDate(featuredPost.publishedAt)} · {estimateReadTime(featuredPost)}{" "}
                </span>
                <span data-tina-field={readTimeSuffix.field}>{readTimeSuffix.value}</span>
              </p>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                <span data-tina-field={tinaField(featuredPost.author, "name")}>{featuredPost.author.name}</span> ·{" "}
                <span data-tina-field={tinaField(featuredPost.author, "role")}>{featuredPost.author.role}</span>
              </p>
              <p className="text-sm text-slate-600 md:text-base" data-tina-field={tinaField(featuredPost, "excerpt")}>
                {featuredPost.excerpt}
              </p>
              <QuoteAwareLink
                className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition hover:brightness-110"
                data-tina-field={tinaField(featuredPost, "slug")}
                href={`/blog/${featuredPost.slug}`}
              >
                <span data-tina-field={featuredCtaLabel.field}>{featuredCtaLabel.value}</span>
                <ArrowRight className="size-4" />
              </QuoteAwareLink>
            </div>
          </Reveal>
        </section>
      ) : (
        <div id="blog-articles" />
      )}

      {hasResults ? (
        <section className="mx-auto mt-6 max-w-7xl px-4 md:mt-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPosts.map((post, index) => (
              <Reveal
                as="article"
                key={post.slug}
                className={`${getGradientVariant(index)} overflow-hidden rounded-md border border-slate-200 shadow-[0_14px_30px_rgba(0,0,0,0.25)]`}
                delay={index * 0.08}
                data-tina-field={tinaField(post)}
              >
                <TakumiBlogCoverImage className="h-52 w-full object-cover" height={640} post={post} width={960} />

                <div className="space-y-4 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500" data-tina-field={tinaField(post, "publishedAt")}>
                    {formatPublishedDate(post.publishedAt)} · {estimateReadTime(post)}{" "}
                    <span data-tina-field={readTimeSuffix.field}>{readTimeSuffix.value}</span>
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <span data-tina-field={tinaField(post.author, "name")}>{post.author.name}</span>
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    <KeywordGradientText dataTinaField={tinaField(post, "title")} text={post.title} />
                  </h2>
                  <p className="text-sm text-slate-600" data-tina-field={tinaField(post, "excerpt")}>
                    {post.excerpt}
                  </p>

                  <div className="flex flex-wrap gap-2" data-tina-field={tinaField(post, "tags")}>
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={`${post.slug}-${tag}`}
                        className="rounded-sm border border-slate-200 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <QuoteAwareLink
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary hover:text-accent"
                    data-tina-field={tinaField(post, "slug")}
                    href={`/blog/${post.slug}`}
                  >
                    <span data-tina-field={cardCtaLabel.field}>{cardCtaLabel.value}</span>
                    <ArrowRight className="size-4" />
                  </QuoteAwareLink>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-6 max-w-7xl px-4 md:mt-8">
          <Reveal className={`${getGradientVariant(0)} rounded-md border border-slate-200 px-6 py-10 text-center`}>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">No articles found</p>
            <p className="mt-2 text-sm text-slate-600">Try a different filter or reset to all topics.</p>
          </Reveal>
        </section>
      )}

      {hasResults && totalPages > 1 ? (
        <section className="mx-auto mt-8 max-w-7xl px-4 md:mt-10">
          <Reveal className={`${getGradientVariant(3)} rounded-md border border-slate-200 px-4 py-4 md:px-5`}>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className={currentPage <= 1 ? "pointer-events-none opacity-45" : ""}
                    href="#blog-articles"
                    onClick={(event) => {
                      event.preventDefault()
                      goToPage(currentPage - 1)
                    }}
                  />
                </PaginationItem>

                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={`page-${item}`}>
                      <PaginationLink
                        href="#blog-articles"
                        isActive={item === currentPage}
                        onClick={(event) => {
                          event.preventDefault()
                          goToPage(item)
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    className={currentPage >= totalPages ? "pointer-events-none opacity-45" : ""}
                    href="#blog-articles"
                    onClick={(event) => {
                      event.preventDefault()
                      goToPage(currentPage + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </Reveal>
        </section>
      ) : null}
    </>
  )
}
