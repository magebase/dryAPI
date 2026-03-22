import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ElementType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlogPostPageTemplate } from "@/components/site/blog-post-page-template";
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema";

type JsonLdProps = Record<string, unknown>;
type MockImageProps = {
  alt?: string;
  priority?: boolean;
  src?: string | { src?: string };
};
type QuoteAwareLinkMockProps = {
  href: string;
  forceQuoteModal?: boolean;
  quoteLabel?: string;
  children?: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>;
type RevealMockProps = {
  as?: ElementType;
  children?: ReactNode;
} & Record<string, unknown>;

let articleJsonLdProps: JsonLdProps | null = null;
let tinaMarkdownContent: BlogPost["body"] | null = null;

const bodyFixture = {
  type: "root",
  children: [
    {
      type: "p",
      children: [{ type: "text", text: "Body value" }],
    },
  ],
};

const siteFixture: SiteConfig = {
  brand: {
    name: "Load Ready",
    mark: "DRYAPI",
  },
  contact: {
    contactEmail: "sales@dryapi.dev",
    quoteEmail: "quotes@dryapi.dev",
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
};

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
};

function findLinkByHref(href: string) {
  return screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === href);
}

vi.mock("next/image", () => ({
  default: (props: MockImageProps) => {
    const { priority, alt = "", src } = props;
    void priority;

    return (
      <span
        data-alt={alt}
        data-src={typeof src === "string" ? src : src?.src ?? ""}
        data-testid="mock-next-image"
      />
    );
  },
}));

vi.mock("next-seo", () => ({
  ArticleJsonLd: (props: JsonLdProps) => {
    articleJsonLdProps = props;
    return <div data-testid="article-jsonld" />;
  },
  BreadcrumbJsonLd: () => <div data-testid="breadcrumb-jsonld" />,
  WebPageJsonLd: () => <div data-testid="webpage-jsonld" />,
}));

vi.mock("citemet", () => ({
  createAIShareURLs: () => ({
    twitter: "https://twitter.com/intent/tweet?text=mock",
    linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=mock",
    facebook: "https://www.facebook.com/sharer/sharer.php?u=mock",
  }),
}));

vi.mock("tinacms/dist/react", () => ({
  tinaField: (_value: unknown, fieldName?: string) =>
    `field:${fieldName ?? "value"}`,
}));

vi.mock("tinacms/dist/rich-text", () => ({
  TinaMarkdown: ({ content }: { content: BlogPost["body"] }) => {
    tinaMarkdownContent = content;
    return <div data-testid="tina-markdown" />;
  },
}));

vi.mock("@/components/site/quote-aware-link", () => ({
  QuoteAwareLink: ({
    href,
    forceQuoteModal,
    quoteLabel,
    children,
    ...props
  }: QuoteAwareLinkMockProps) => {
    void quoteLabel;

    return (
      <a
        data-force-quote-modal={forceQuoteModal ? "true" : "false"}
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  },
}));

vi.mock("@/components/site/reveal", () => ({
  Reveal: ({ as: Component = "section", children, ...props }: RevealMockProps) => {
    const Tag = Component;

    return <Tag {...props}>{children}</Tag>;
  },
}));

vi.mock("@/lib/brand-catalog", () => ({
  normalizeSiteUrl: () => "https://dryapi.dev",
}));

describe("BlogPostPageTemplate", () => {
  afterEach(() => {
    vi.clearAllMocks();
    articleJsonLdProps = null;
    tinaMarkdownContent = null;
  });

  it("renders with basic metadata and schema", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://dryapi.dev";
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />);

    expect(articleJsonLdProps?.headline).toBe("Generator Hire Guide");
    expect(articleJsonLdProps?.url).toContain("blog/custom-path");
    expect(screen.getAllByText("Generator Hire Guide").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText("How to choose the right setup."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ada Byron").length).toBeGreaterThan(0);
    expect(screen.getByTestId("article-jsonld")).toBeInTheDocument();
  });

  it("links back to blog", () => {
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />);

    const backLink = findLinkByHref("/blog");
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveTextContent("Back");
  });

  it("renders body via TinaMarkdown", () => {
    render(<BlogPostPageTemplate post={postFixture} site={siteFixture} />);

    expect(screen.getByTestId("tina-markdown")).toBeInTheDocument();
    expect(tinaMarkdownContent).toEqual(bodyFixture);
  });

  it("handles missing initials for author name", () => {
    const unnamedAuthorPost = {
      ...postFixture,
      author: { ...postFixture.author, name: "", avatar: "" },
    };

    render(
      <BlogPostPageTemplate post={unnamedAuthorPost} site={siteFixture} />,
    );

    const avatarContainer = screen.queryByText("GF");
    expect(avatarContainer).toBeInTheDocument();
  });
});
