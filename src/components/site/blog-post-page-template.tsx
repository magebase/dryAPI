import Image from "next/image";
import { ArticleJsonLd } from "next-seo";
import {
  ArrowRight,
  BookText,
  Clock3,
  MessageSquare,
  TableOfContents,
  Tag,
} from "lucide-react";
import { isValidElement, useEffect, useMemo, useState } from "react";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";

import { KeywordGradientText } from "@/components/site/keyword-gradient-text";
import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { Reveal } from "@/components/site/reveal";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import { SummarizeWithAi } from "@/components/site/summarize-with-ai";
import { TryModelCta } from "@/components/site/try-model-cta";
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema";

type TinaMarkdownContentLike = Parameters<typeof TinaMarkdown>[0]["content"];

type ActiveModelInfo = {
  displayName: string;
  playgroundHref: string;
};

type BlogPostPageTemplateProps = {
  post: BlogPost;
  site: SiteConfig;
  activeModel?: ActiveModelInfo;
};

function formatPublishedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeCanonicalPath(
  slug: string,
  canonicalPath: string | undefined,
) {
  const raw = canonicalPath?.trim();
  if (!raw) {
    return `/blog/${slug}`;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function toJsonLdDate(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function getAuthorInitials(name: string) {
  const letters = name
    .split(/\s+/)
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "GF";
}

function collectWordsFromRichText(value: unknown): number {
  const words: string[] = [];

  const appendWords = (text: string) => {
    words.push(...text.trim().split(/\s+/).filter(Boolean));
  };

  const walk = (nodeValue: unknown) => {
    if (!nodeValue || typeof nodeValue !== "object") {
      return;
    }

    const node = nodeValue as { text?: unknown; children?: unknown[] };

    if (typeof node.text === "string") {
      appendWords(node.text);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => walk(child));
    }
  };

  walk(value);
  return words.length;
}

function estimateReadTime(post: BlogPost) {
  const words = collectWordsFromRichText(post.body);
  const fallbackWords = post.excerpt.trim().split(/\s+/).filter(Boolean).length;
  const totalWords = words > 0 ? words : fallbackWords;
  return Math.max(1, Math.ceil(totalWords / 220));
}

function extractNodeText(nodeValue: unknown): string {
  if (!nodeValue || typeof nodeValue !== "object") {
    return "";
  }

  const node = nodeValue as { text?: unknown; children?: unknown[] };
  const fragments: string[] = [];

  if (typeof node.text === "string") {
    fragments.push(node.text);
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      const text = extractNodeText(child);
      if (text) {
        fragments.push(text);
      }
    });
  }

  return fragments.join(" ").replace(/\s+/g, " ").trim();
}

function slugifyHeading(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return normalized || "section";
}

type HeadingAnchor = {
  id: string;
  title: string;
  level: number;
};

function collectHeadingAnchors(value: unknown): HeadingAnchor[] {
  const anchors: HeadingAnchor[] = [];

  const visit = (nodeValue: unknown) => {
    if (!nodeValue || typeof nodeValue !== "object") {
      return;
    }

    const node = nodeValue as { type?: unknown; children?: unknown[] };

    if (typeof node.type === "string" && /^h[1-6]$/.test(node.type)) {
      const title = extractNodeText(node);
      if (title) {
        const level = Number(node.type.slice(1));
        anchors.push({
          id: slugifyHeading(title),
          title,
          level,
        });
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => visit(child));
    }
  };

  visit(value);
  return anchors;
}

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node
      .map((child) => extractTextFromReactNode(child))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextFromReactNode(node.props.children);
  }

  return "";
}

export function BlogPostPageTemplate({
  post,
  site,
  activeModel,
}: BlogPostPageTemplateProps) {
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;

      if (scrollable <= 0) {
        setReadingProgress(0);
        return;
      }

      const progress = (window.scrollY / scrollable) * 100;
      setReadingProgress(Math.max(0, Math.min(100, progress)));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://genfix.com.au"
  ).replace(/\/+$/, "");
  const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath);
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const publishedIso = toJsonLdDate(post.publishedAt);
  const articleImage = post.ogImage?.trim() || post.coverImage;
  const readTime = estimateReadTime(post);
  const headingAnchors = useMemo(
    () => collectHeadingAnchors(post.body),
    [post.body],
  );
  const tocAnchors = useMemo(
    () =>
      headingAnchors.filter(
        (heading) => heading.level === 2 || heading.level === 3,
      ),
    [headingAnchors],
  );

  const markdownComponents = {
    h1: (props: { children?: React.ReactNode } | undefined) => {
      const children = props?.children;
      const id = slugifyHeading(extractTextFromReactNode(children));
      return (
        <h2
          className="text-site-strong mt-10 scroll-mt-24 text-3xl font-semibold tracking-tight first:mt-0"
          id={id}
        >
          {children}
        </h2>
      );
    },
    h2: (props: { children?: React.ReactNode } | undefined) => {
      const children = props?.children;
      const id = slugifyHeading(extractTextFromReactNode(children));
      return (
        <h2
          className="text-site-strong mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0"
          id={id}
        >
          {children}
        </h2>
      );
    },
    h3: (props: { children?: React.ReactNode } | undefined) => {
      const children = props?.children;
      const id = slugifyHeading(extractTextFromReactNode(children));
      return (
        <h3
          className="text-site-strong mt-8 scroll-mt-24 text-xl font-semibold tracking-tight"
          id={id}
        >
          {children}
        </h3>
      );
    },
    h4: (props: { children?: React.ReactNode } | undefined) => {
      const children = props?.children;
      const id = slugifyHeading(extractTextFromReactNode(children));
      return (
        <h4
          className="text-site-strong mt-7 scroll-mt-24 text-lg font-semibold"
          id={id}
        >
          {children}
        </h4>
      );
    },
    p: (props: { children?: React.ReactNode } | undefined) => (
      <p className="text-site-muted mt-4 text-[1.04rem] leading-8 first:mt-0">
        {props?.children}
      </p>
    ),
    ul: (props: { children?: React.ReactNode } | undefined) => (
      <ul className="text-site-muted mt-5 list-disc space-y-2 pl-6 marker:text-orange-500">
        {props?.children}
      </ul>
    ),
    ol: (props: { children?: React.ReactNode } | undefined) => (
      <ol className="text-site-muted mt-5 list-decimal space-y-2 pl-6 marker:text-orange-500">
        {props?.children}
      </ol>
    ),
    li: (props: { children?: React.ReactNode } | undefined) => (
      <li className="leading-7">{props?.children}</li>
    ),
    lic: (props: { children?: React.ReactNode } | undefined) => (
      <>{props?.children}</>
    ),
    a: (props: { url?: string; children?: React.ReactNode } | undefined) => {
      const url = props?.url ?? "";
      const isExternal = /^https?:\/\//i.test(url);

      return (
        <a
          className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-800"
          href={url}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {props?.children}
        </a>
      );
    },
    blockquote: (props: { children?: React.ReactNode } | undefined) => (
      <blockquote className="text-site-muted mt-6 rounded-r-lg border-l-4 border-orange-400 bg-orange-50/60 px-5 py-3 italic">
        {props?.children}
      </blockquote>
    ),
    code: (props: { children?: React.ReactNode } | undefined) => (
      <code className="text-site-strong rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em]">
        {props?.children}
      </code>
    ),
    code_block: (props: { value?: string; lang?: string } | undefined) => (
      <pre className="text-site-inverse mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm">
        {props?.lang ? (
          <p className="text-site-inverse-soft mb-3 text-xs uppercase tracking-[0.14em]">
            {props.lang}
          </p>
        ) : null}
        <code className="font-mono leading-6">{props?.value ?? ""}</code>
      </pre>
    ),
    hr: () => <hr className="my-10 border-slate-200" />,
  };

  const quoteHref = site.header.quoteCta.href;
  const quoteLabel = site.header.quoteCta.label;
  const blogLink = site.header.primaryLinks.find(
    (link) => link.href === "/blog",
  );
  const resourcesLink = site.header.primaryLinks.find(
    (link) => link.href === "/resources",
  );

  const backToBlog = resolveSiteUiText(
    site,
    "blogPost.backToBlog",
    blogLink?.label ?? "Back To Blog",
  );
  const nextStepKicker = resolveSiteUiText(
    site,
    "blogPost.nextStepKicker",
    "Next Step",
  );
  const nextStepHeading = resolveSiteUiText(
    site,
    "blogPost.nextStepHeading",
    "Need A Cheaper, Scalable API Stack?",
  );
  const nextStepBody = resolveSiteUiText(
    site,
    "blogPost.nextStepBody",
    `Talk to the ${site.brand.mark} team for practical guidance on model routing, cost control, and production rollout.`,
  );
  const resourcesPrefix = resolveSiteUiText(
    site,
    "blogPost.resourcesPrefix",
    "View",
  );

  return (
    <main className="text-site-strong overflow-x-clip bg-[radial-gradient(circle_at_top_left,#fff6ec_0,#f8fafc_34%,#f8fafc_100%)] pb-16 md:pb-20">
      <div className="sticky top-0 z-40 h-1 w-full bg-slate-900/10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/5">
        <div
          aria-hidden
          className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-blue-500 transition-[width] duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

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

      <section className="relative isolate overflow-hidden border-b border-slate-200">
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary hover:text-accent"
            data-tina-field={blogLink ? tinaField(blogLink) : undefined}
            href="/blog"
          >
            <ArrowRight className="size-4 rotate-180" />
            {backToBlog.value}
          </QuoteAwareLink>

          <h1 className="text-site-inverse mt-4 font-display text-3xl uppercase leading-[1.06] tracking-[0.03em] sm:text-4xl md:text-6xl">
            <KeywordGradientText
              dataTinaField={tinaField(post, "title")}
              text={post.title}
            />
          </h1>

          <p
            className="text-site-inverse-muted mt-4 text-sm sm:text-base md:text-lg"
            data-tina-field={tinaField(post, "excerpt")}
          >
            {post.excerpt}
          </p>

          <p className="text-site-inverse-muted mt-5 inline-flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em]">
            <BookText className="size-4" />
            <span data-tina-field={tinaField(post, "publishedAt")}>
              {formatPublishedDate(post.publishedAt)}
            </span>
            <span className="text-site-inverse-soft">|</span>
            <span data-tina-field={tinaField(post.author, "name")}>
              {post.author.name}
            </span>
            <span className="text-site-inverse-soft">|</span>
            <span data-tina-field={tinaField(post.author, "role")}>
              {post.author.role}
            </span>
            <span className="text-site-inverse-soft">|</span>
            <Clock3 className="size-4" />
            <span>{readTime} min read</span>
          </p>

          <div
            className="mt-5 flex flex-wrap gap-2"
            data-tina-field={tinaField(post, "tags")}
          >
            {post.tags.slice(0, 4).map((tag) => (
              <span
                key={`${post.slug}-${tag}`}
                className="text-site-inverse inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]"
              >
                <Tag className="size-3" />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {activeModel ? (
        <TryModelCta
          className="mt-4"
          modelDisplayName={activeModel.displayName}
          playgroundHref={activeModel.playgroundHref}
        />
      ) : null}

      <section className="mx-auto mt-8 max-w-6xl px-4 md:mt-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <Reveal
            as="article"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-[0_14px_38px_rgba(15,23,42,0.08)] md:px-8 md:py-8"
          >
            <div className="mb-4 flex items-center justify-end border-b border-slate-100 pb-4">
              <SummarizeWithAi
                brandName={site.brand.mark}
                pageUrl={canonicalUrl}
                title={post.title}
              />
            </div>
            <div
              className="[&_table]:mt-6 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-700 [&_tr:first-child_td]:bg-slate-50 [&_tr:first-child_td]:font-semibold [&_tr:first-child_td]:text-slate-900"
              data-tina-field={tinaField(post, "body")}
            >
              <TinaMarkdown
                components={markdownComponents}
                content={post.body as TinaMarkdownContentLike}
              />
            </div>
          </Reveal>

          {tocAnchors.length > 0 ? (
            <Reveal as="section" className="hidden lg:block">
              <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
                <p className="text-site-soft inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em]">
                  <TableOfContents className="size-4" />
                  <span>On This Page</span>
                </p>
                <nav aria-label="Table of contents" className="mt-3 space-y-2">
                  {tocAnchors.map((anchor) => (
                    <a
                      key={anchor.id}
                      className={`text-site-muted block text-sm leading-relaxed transition-colors hover:text-[color:var(--site-text-strong)] ${
                        anchor.level === 3 ? "pl-3" : ""
                      }`}
                      href={`#${anchor.id}`}
                    >
                      {anchor.title}
                    </a>
                  ))}
                </nav>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {activeModel ? (
        <TryModelCta
          className="mt-8"
          modelDisplayName={activeModel.displayName}
          playgroundHref={activeModel.playgroundHref}
        />
      ) : null}

      <Reveal as="section" className="mx-auto mt-8 max-w-3xl px-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:px-8">
          <div
            className="flex items-start gap-4"
            data-tina-field={tinaField(post, "author")}
          >
            {post.author.avatar ? (
              <Image
                alt={post.author.name}
                className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                data-tina-field={tinaField(post.author, "avatar")}
                height={56}
                src={post.author.avatar}
                width={56}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold uppercase text-slate-900">
                {getAuthorInitials(post.author.name)}
              </div>
            )}

            <div>
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-orange-700">
                <BookText className="size-4" />
                <span>Author</span>
              </p>
              <p
                className="text-site-strong mt-1 text-base font-semibold"
                data-tina-field={tinaField(post.author, "name")}
              >
                {post.author.name}
              </p>
              <p
                className="text-site-soft text-sm"
                data-tina-field={tinaField(post.author, "role")}
              >
                {post.author.role}
              </p>
              {post.author.bio ? (
                <p
                  className="text-site-muted mt-3 text-sm leading-relaxed"
                  data-tina-field={tinaField(post.author, "bio")}
                >
                  {post.author.bio}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal
        as="section"
        className="mx-auto mt-10 max-w-3xl rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)] md:mt-12 md:px-6 md:py-6"
      >
        <p
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-orange-700"
          data-tina-field={nextStepKicker.field}
        >
          <MessageSquare className="size-4" />
          <span>{nextStepKicker.value}</span>
        </p>
        <h2 className="text-site-strong mt-2 text-lg font-semibold uppercase tracking-[0.14em]">
          <KeywordGradientText
            dataTinaField={nextStepHeading.field}
            text={nextStepHeading.value}
          />
        </h2>
        <p
          className="text-site-muted mt-3"
          data-tina-field={nextStepBody.field}
        >
          {nextStepBody.value}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <QuoteAwareLink
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-orange-300 bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-900 shadow-lg transition hover:brightness-105 sm:w-auto"
            data-tina-field={tinaField(site.header, "quoteCta")}
            forceQuoteModal
            href={quoteHref}
            quoteLabel={quoteLabel}
          >
            <span>{quoteLabel}</span>
            <ArrowRight className="size-4" />
          </QuoteAwareLink>

          <QuoteAwareLink
            className="text-site-muted inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary/40 hover:text-[color:var(--site-text-strong)] sm:w-auto"
            data-tina-field={
              resourcesLink ? tinaField(resourcesLink) : undefined
            }
            href={resourcesLink?.href ?? "/resources"}
          >
            <span data-tina-field={resourcesPrefix.field}>
              {resourcesPrefix.value}
            </span>{" "}
            <span>{resourcesLink?.label ?? "Resources"}</span>
            <ArrowRight className="size-4" />
          </QuoteAwareLink>
        </div>
      </Reveal>
    </main>
  );
}
