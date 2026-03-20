import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BlogPostPageTemplate } from "@/components/site/blog-post-page-template"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

let articleJsonLdProps: any = null
let tinaMarkdownContent: any = null

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
    siteUrl: "https://genfix.com.au",
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
  default: ({ priority: _priority, ...props }: any) => <img {...props} />,
}))

vi.mock("next-seo", () => ({
  ArticleJsonLd: (props: any) => {
    articleJsonLdProps = props
    return <div data-testid="article-jsonld" />
  },
  BreadcrumbJsonLd: () => <div data-testid="breadcrumb-jsonld" />,
  WebPageJsonLd: () => <div data-testid="webpage-jsonld" />,
}))

vi.mock("citemet", () => ({
  createAIShareURLs: () => ({
    twitter: "https://twitter.com/intent/tweet?text=mock",
    linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=mock",
    facebook: "https://www.facebook.com/sharer/sharer.php?u=mock",
  }),
}))

vi.mock("tinacms/dist/react", () => ({
  tinaField: (_value: any, fieldName?: string) => `field:${fieldName ?? "value"}`,
}))

vi.mock("tinacms/dist/rich-text", () => ({
  TinaMarkdown: ({ content }: { content: any }) => {
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
  }: any) => (
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
  }: any) => <Component {...props}>{children}</Component>,
}))

vi.mock("@/lib/brand-catalog", () => ({
  normalizeSiteUrl: () => "https://genfix.com.au",
}))

describe("BlogPostPageTemplate", () => {
  afterEach(() => {
    vi.clearAllMocks()
    articleJsonLdProps = null
    tinaMarkdownContent = null
  })

  it("renders with basic metadata and schema", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://genfix.com.au"
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />)

    expect(articleJsonLdProps?.headline).toBe("Generator Hire Guide")
    expect(articleJsonLdProps?.url).toContain("blog/custom-path")
    expect(screen.getAllByText("Generator Hire Guide").length).toBeGreaterThan(0)
    expect(screen.getByText("How to choose the right setup.")).toBeInTheDocument()
    expect(screen.getAllByText("Ada Byron").length).toBeGreaterThan(0)
    expect(screen.getByTestId("article-jsonld")).toBeInTheDocument()
  })

  it("links back to blog", () => {
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />)

    const backLink = findLinkByHref("/blog")
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveTextContent("Back")
  })

  it("renders body via TinaMarkdown", () => {
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />)

    expect(screen.getByTestId("tina-markdown")).toBeInTheDocument()
    expect(tinaMarkdownContent).toEqual(bodyFixture)
  })

  it("handles missing initials for author name", () => {
    const unnamedAuthorPost = {
      ...postFixture,
      author: { ...postFixture.author, name: "", avatar: "" },
    }

    render(<BlogPostPageTemplate post={unnamedAuthorPost} site={siteFixture} />)

    const avatarContainer = screen.queryByText("GF")
    expect(avatarContainer).toBeInTheDocument()
  })
})
