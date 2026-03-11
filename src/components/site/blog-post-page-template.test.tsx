import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BlogPostPageTemplate } from "@/components/site/blog-post-page-template"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

let articleJsonLdProps: Record<string, unknown> | null = null
let tinaMarkdownContent: unknown = null

const bodyFixture = {
  type: "root",
  children: [
    {
      type: "p",
      children: [{ type: "text", text: "Body value" }],
    },
  ],
}

const siteFixture: SiteConfig = {
  brand: {
    name: "Load Ready",
    mark: "GENFIX",
  },
  contact: {
    contactEmail: "sales@genfix.com.au",
    quoteEmail: "quotes@genfix.com.au",
  },
  announcement: "Brisbane diesel generator specialists.",
  header: {
    primaryLinks: [
      {
        label: "Blog",
        href: "/blog",
      },
      {
        label: "Resources",
        href: "/resources",
      },
    ],
    phone: {
      label: "1300 365 721",
      href: "tel:1300365721",
    },
    quoteCta: {
      label: "Get A Quote",
      href: "/contact",
      style: "outline",
    },
  },
  footer: {
    companyText: "Power solutions for critical sites.",
    contactLinks: [],
    socialLinks: [],
    columns: [],
    legalLinks: [],
  },
  uiText: [
    {
      key: "blogPost.backToBlog",
      value: "Back",
    },
  ],
}

const postFixture: BlogPost = {
  slug: "generator-hire-guide",
  title: "Generator Hire Guide",
  excerpt: "How to choose the right setup.",
  seoTitle: "Generator Hire Guide",
  seoDescription: "How to choose the right setup.",
  seoKeywords: ["generator", "hire"],
  canonicalPath: "blog/custom-path",
  ogImage: "/images/social-card.png",
  noindex: false,
  publishedAt: "2026-01-20",
  author: {
    name: "Ada Byron",
    role: "Engineer",
    bio: "Technical lead",
    avatar: "/images/ada.png",
  },
  coverImage: "/images/cover.png",
  tags: ["guides"],
  body: bodyFixture,
}

function findLinkByHref(href: string) {
  return screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === href)
}

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) => <img {...props} />,
}))

vi.mock("next-seo", () => ({
  ArticleJsonLd: (props: Record<string, unknown>) => {
    articleJsonLdProps = props
    return <div data-testid="article-jsonld" />
  },
}))

vi.mock("tinacms/dist/react", () => ({
  tinaField: (_value: unknown, fieldName?: string) => `field:${fieldName ?? "value"}`,
}))

vi.mock("tinacms/dist/rich-text", () => ({
  TinaMarkdown: ({ content }: { content: unknown }) => {
    tinaMarkdownContent = content
    return <div data-testid="tina-markdown" />
  },
}))

vi.mock("@/components/site/quote-aware-link", () => ({
  QuoteAwareLink: ({
    href,
    forceQuoteModal,
    quoteLabel: _quoteLabel,
    children,
    ...props
  }: React.ComponentProps<"a"> & {
    href: string
    forceQuoteModal?: boolean
    quoteLabel?: string
  }) => (
    <a data-force-quote-modal={forceQuoteModal ? "true" : "false"} href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/site/reveal", () => ({
  Reveal: ({
    as: Component = "section",
    children,
    ...props
  }: {
    as?: "section" | "div" | "article"
    children: React.ReactNode
  } & React.HTMLAttributes<HTMLElement>) => {
    return <Component {...props}>{children}</Component>
  },
}))

afterEach(() => {
  articleJsonLdProps = null
  tinaMarkdownContent = null
  delete process.env.NEXT_PUBLIC_SITE_URL
})

describe("BlogPostPageTemplate", () => {
  it("builds structured data and action links from canonical and site inputs", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org///"

    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />)

    expect(screen.getByTestId("article-jsonld")).toBeInTheDocument()
    expect(screen.getByTestId("tina-markdown")).toBeInTheDocument()
    expect(tinaMarkdownContent).toBe(postFixture.body)

    expect(articleJsonLdProps?.url).toBe("https://example.org/blog/custom-path")
    expect(articleJsonLdProps?.image).toEqual([postFixture.ogImage])
    expect(articleJsonLdProps?.datePublished).toBe("2026-01-20T00:00:00.000Z")
    expect(articleJsonLdProps?.scriptId).toBe(`blog-post-jsonld-${postFixture.slug}`)

    const mainEntity = articleJsonLdProps?.mainEntityOfPage as { "@id"?: string } | undefined
    expect(mainEntity?.["@id"]).toBe("https://example.org/blog/custom-path")

    const quoteLink = findLinkByHref("/contact")
    expect(quoteLink).toBeTruthy()
    expect(quoteLink).toHaveAttribute("data-force-quote-modal", "true")

    const resourcesLink = findLinkByHref("/resources")
    expect(resourcesLink).toBeTruthy()
    expect(resourcesLink).toHaveAttribute("data-force-quote-modal", "false")

    const backLink = findLinkByHref("/blog")
    expect(backLink).toBeTruthy()
    expect(backLink).toHaveAttribute("data-tina-field", "field:value")

    expect(screen.getByAltText(postFixture.title)).toBeInTheDocument()
    expect(screen.getByAltText(postFixture.author.name)).toBeInTheDocument()
  })

  it("uses fallback canonical, social image, and author badge branches when optional fields are absent", () => {
    const siteWithoutResourceLink: SiteConfig = {
      ...siteFixture,
      header: {
        ...siteFixture.header,
        primaryLinks: [{ label: "Blog", href: "/blog" }],
      },
      uiText: [],
    }

    const postWithoutOptionalFields: BlogPost = {
      ...postFixture,
      canonicalPath: undefined,
      ogImage: undefined,
      publishedAt: "invalid-date",
      author: {
        ...postFixture.author,
        name: "Jamie Lee",
        avatar: undefined,
      },
    }

    render(<BlogPostPageTemplate post={postWithoutOptionalFields} site={siteWithoutResourceLink} />)

    expect(articleJsonLdProps?.url).toBe(`https://genfix.com.au/blog/${postWithoutOptionalFields.slug}`)
    expect(articleJsonLdProps?.image).toEqual([postWithoutOptionalFields.coverImage])
    expect(Object.prototype.hasOwnProperty.call(articleJsonLdProps ?? {}, "datePublished")).toBe(false)

    const resourcesLink = findLinkByHref("/resources")
    expect(resourcesLink).toBeTruthy()
    expect(resourcesLink).not.toHaveAttribute("data-tina-field")

    expect(screen.queryByAltText(postWithoutOptionalFields.author.name)).toBeNull()
    expect(screen.getAllByRole("img")).toHaveLength(1)
  })
})
