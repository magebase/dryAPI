import Image from "next/image";
import { ArticleJsonLd } from "next-seo";
import {
  ArrowRight,
  BookText,
  Clock3,
  MessageSquare,
  Share2,
  TableOfContents,
  Tag,
} from "lucide-react";
import { isValidElement, useEffect, useMemo, useState } from "react";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";

import { CmsImage } from "@/components/site/cms-image";
import { KeywordGradientText } from "@/components/site/keyword-gradient-text";
import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { Reveal } from "@/components/site/reveal";
import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text";
import { SummarizeWithAi } from "@/components/site/summarize-with-ai";
import { TryModelCta } from "@/components/site/try-model-cta";
import { normalizeSiteImageSrc } from "@/lib/site-image";
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
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://dryapi.dev"
  ).replace(/\/+$/, "");
  const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath);
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const publishedIso = toJsonLdDate(post.publishedAt);
  const normalizedCoverImage = normalizeSiteImageSrc(post.coverImage);
  const normalizedArticleImage = normalizeSiteImageSrc(
    post.ogImage?.trim() || post.coverImage,
  );
  const normalizedAuthorAvatar = post.author.avatar?.trim()
    ? normalizeSiteImageSrc(post.author.avatar)
    : "";
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
          className="text-site-strong border-site-muted/12 mt-12 border-b-2 pb-5 scroll-mt-24 text-3xl font-semibold tracking-tight first:mt-0"
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
          className="text-site-strong border-site-muted/12 mt-12 border-b-2 pb-5 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0"
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
          className="text-site-strong mt-10 scroll-mt-24 text-xl font-semibold tracking-tight"
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
          className="text-site-strong mt-8 border-none bg-transparent p-0 scroll-mt-24 text-lg font-semibold"
          id={id}
        >
          {children}
        </h4>
      );
    },
    p: (props: { children?: React.ReactNode } | undefined) => (
      <p className="text-site-muted/90 mt-5 text-[1.1rem] leading-8 font-serif first:mt-0">
        {props?.children}
      </p>
    ),
    ul: (props: { children?: React.ReactNode } | undefined) => (
      <ul className="text-site-muted/90 mt-6 list-disc space-y-3 pl-6 marker:text-primary">
        {props?.children}
      </ul>
    ),
    ol: (props: { children?: React.ReactNode } | undefined) => (
      <ol className="text-site-muted/90 mt-6 list-decimal space-y-3 pl-6 marker:text-primary">
        {props?.children}
      </ol>
    ),
    li: (props: { children?: React.ReactNode } | undefined) => (
      <li className="leading-relaxed font-serif pl-1">{props?.children}</li>
    ),
    lic: (props: { children?: React.ReactNode } | undefined) => (
      <>{props?.children}</>
    ),
    a: (props: { url?: string; children?: React.ReactNode } | undefined) => {
      const url = props?.url ?? "";
      const isExternal = /^https?:\/\//i.test(url);

      return (
        <a
          className="font-medium text-primary underline decoration-primary/30 decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          href={url}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {props?.children}
        </a>
      );
    },
    blockquote: (props: { children?: React.ReactNode } | undefined) => (
      <blockquote className="text-site-soft mt-8 border-l-4 border-primary bg-slate-50/50 px-6 py-4 italic shadow-sm italic-serif">
        <div className="[&_p]:text-xl [&_p]:leading-relaxed [&_p]:font-serif [&_p]:text-site-muted">
          {props?.children}
        </div>
      </blockquote>
    ),
    code: (props: { children?: React.ReactNode } | undefined) => (
      <code className="text-site-strong rounded bg-[color:var(--site-surface-1)] px-1.5 py-0.5 font-mono text-[0.92em]">
        {props?.children}
      </code>
    ),
    code_block: (props: { value?: string; lang?: string } | undefined) => (
      <div className="group relative mt-10">
        <pre className="text-site-inverse overflow-x-auto rounded-xl border border-white/12 bg-slate-900/98 p-6 shadow-2xl">
          {props?.lang ? (
            <div className="flex items-center justify-between mb-5">
              <span className="text-site-inverse-soft bg-white/10 px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.2em] font-semibold">
                {props.lang}
              </span>
              <button 
                onClick={() => {
                  if (props.value) {
                    navigator.clipboard.writeText(props.value);
                  }
                }}
                className="text-white/40 hover:text-white transition-colors"
                title="Copy code"
              >
                <Share2 className="size-4" />
              </button>
            </div>
          ) : null}
          <code className="block font-mono text-[0.92rem] leading-7 antialiased">{props?.value ?? ""}</code>
        </pre>
      </div>
    ),
    img: (
      props:
        | {
            url?: string;
            alt?: string;
            caption?: string;
          }
        | undefined,
    ) => {
      const src = props?.url?.trim();

      if (!src) {
        return null;
      }

      return (
        <figure className="mt-10 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <CmsImage
            alt={props?.alt ?? "Article illustration"}
            className="h-auto w-full object-cover"
            height={840}
            sizes="(min-width: 1024px) 896px, 100vw"
            src={src}
            width={1400}
          />
          {props?.caption ? (
            <figcaption className="border-t border-slate-100 px-5 py-3 text-xs font-medium tracking-[0.04em] text-slate-500">
              {props.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    },
    hr: () => <hr className="my-16 border-t-2 border-slate-100/60" />,
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
    <main className="text-site-strong overflow-x-clip bg-white pb-16 md:pb-24">
      <div className="fixed top-0 left-0 right-0 z-[60] h-1.5 w-full bg-slate-900/5">
        <div
          aria-hidden
          className="h-full bg-gradient-to-r from-primary via-accent to-blue-500 transition-[width] duration-300 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
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
        image={[normalizedArticleImage]}
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

      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />
        <Image
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover opacity-30 grayscale-[0.4] blur-[2px] transition-transform duration-[10s] hover:scale-105"
          height={1080}
          priority
          src={normalizedCoverImage}
          width={1920}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0)_0%,rgba(15,23,42,0.6)_100%)]" />

        <Reveal className="relative mx-auto max-w-5xl px-6 pb-20 pt-28 md:pb-28 md:pt-36 lg:pb-36 lg:pt-44">
          <div className="flex flex-col items-center text-center">
            <QuoteAwareLink
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 shadow-sm text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition hover:bg-white/10 hover:text-accent"
              data-tina-field={blogLink ? tinaField(blogLink) : undefined}
              href="/blog"
            >
              {backToBlog.value}
            </QuoteAwareLink>

            <h1 className="text-site-inverse mt-8 max-w-4xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-7xl">
              <KeywordGradientText
                dataTinaField={tinaField(post, "title")}
                text={post.title}
              />
            </h1>

            <p
              className="text-site-inverse-muted mt-8 max-w-2xl text-base font-medium leading-relaxed sm:text-lg md:text-xl opacity-90"
              data-tina-field={tinaField(post, "excerpt")}
            >
              {post.excerpt}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
              <div className="flex items-center gap-2">
                <BookText className="size-3.5 text-primary" />
                <span data-tina-field={tinaField(post, "publishedAt")}>
                  {formatPublishedDate(post.publishedAt)}
                </span>
              </div>
              <span className="hidden sm:inline bg-white/20 h-3 w-[1px]" />
              <div className="flex items-center gap-2">
                <Clock3 className="size-3.5 text-primary" />
                <span>{readTime} MIN READ</span>
              </div>
              <span className="hidden sm:inline bg-white/20 h-3 w-[1px]" />
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span data-tina-field={tinaField(post.author, "name")}>
                  {post.author.name}
                </span>
              </div>
            </div>

            <div
              className="mt-10 flex flex-wrap justify-center gap-3"
              data-tina-field={tinaField(post, "tags")}
            >
              {post.tags.slice(0, 4).map((tag) => (
                <span
                  key={`${post.slug}-${tag}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-4 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-primary/40 hover:text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
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

      <section className="mx-auto mt-12 max-w-7xl px-6 md:mt-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <Reveal
            as="article"
            className="rounded-2xl border border-slate-100 bg-white px-6 py-8 shadow-[0_22px_48px_rgba(15,23,42,0.05)] md:px-12 md:py-16"
          >
            <div className="mb-10 flex items-center justify-between border-b border-slate-100 pb-8">
              <div className="flex gap-4 items-center">
                 <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-site-soft">
                            {i}
                        </div>
                    ))}
                 </div>
                 <span className="text-xs font-bold uppercase tracking-widest text-site-soft">Shared by 1.2k+</span>
              </div>
              <SummarizeWithAi
                brandName={site.brand.mark}
                pageUrl={canonicalUrl}
                title={post.title}
              />
            </div>
            <div
              className="[&_table]:mt-10 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-600 [&_tr:first-child_td]:bg-slate-50/50 [&_tr:first-child_td]:font-bold [&_tr:first-child_td]:text-site-strong [&_tr:first-child_td]:uppercase [&_tr:first-child_td]:tracking-wider [&_tr:first-child_td]:text-[11px]"
              data-tina-field={tinaField(post, "body")}
            >
              <TinaMarkdown
                components={markdownComponents}
                content={post.body as TinaMarkdownContentLike}
              />
            </div>
          </Reveal>

          <div className="sticky top-24 space-y-8 hidden lg:block">
            {tocAnchors.length > 0 ? (
                <Reveal as="section">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-6 backdrop-blur-sm">
                    <p className="text-site-soft inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-site-soft">
                    <TableOfContents className="size-4 text-primary" />
                    <span>On This Page</span>
                    </p>
                    <nav aria-label="Table of contents" className="mt-6 space-y-4">
                    {tocAnchors.map((anchor) => (
                        <a
                        key={anchor.id}
                        className={`text-slate-600 block text-[13px] font-medium leading-relaxed transition-all hover:text-primary hover:translate-x-1 ${
                            anchor.level === 3 ? "pl-4 border-l border-slate-200 ml-1" : ""
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

            <Reveal as="section">
                <div className="rounded-2xl border border-slate-100 bg-slate-900 p-6 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 bg-primary/20 rounded-full blur-3xl transition-transform group-hover:scale-150" />
                    <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Limited Offer</p>
                    <h4 className="relative z-10 mt-2 text-white font-bold leading-tight">Scale your AI with $100 free credits.</h4>
                    <QuoteAwareLink
                        href={quoteHref}
                        quoteLabel={quoteLabel}
                        className="relative z-10 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-950 transition-transform active:scale-95"
                    >
                        Claim Now
                        <ArrowRight className="size-4" />
                    </QuoteAwareLink>
                </div>
            </Reveal>
          </div>
        </div>
      </section>

      {activeModel ? (
        <TryModelCta
          className="mt-12"
          modelDisplayName={activeModel.displayName}
          playgroundHref={activeModel.playgroundHref}
        />
      ) : null}

      <Reveal as="section" className="mx-auto mt-12 max-w-4xl px-6">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 px-6 py-8 md:px-12 md:py-10">
          <div
            className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left"
            data-tina-field={tinaField(post, "author")}
          >
            {normalizedAuthorAvatar ? (
              <Image
                alt={post.author.name}
                className="h-20 w-20 rounded-full border-4 border-white shadow-md grayscale-[0.2] transition-all hover:grayscale-0"
                data-tina-field={tinaField(post.author, "avatar")}
                height={80}
                src={normalizedAuthorAvatar}
                width={80}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-lg font-bold uppercase text-site-soft shadow-md">
                {getAuthorInitials(post.author.name)}
              </div>
            )}

            <div className="flex-1">
              <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                <BookText className="size-4" />
                <span>Written By</span>
              </p>
              <p
                className="text-site-strong mt-2 text-xl font-bold"
                data-tina-field={tinaField(post.author, "name")}
              >
                {post.author.name}
              </p>
              <p
                className="text-site-muted text-xs font-bold uppercase tracking-widest mt-1"
                data-tina-field={tinaField(post.author, "role")}
              >
                {post.author.role}
              </p>
              {post.author.bio ? (
                <p
                  className="text-slate-600 mt-6 text-base leading-relaxed font-serif"
                  data-tina-field={tinaField(post.author, "bio")}
                >
                  {post.author.bio}
                </p>
              ) : null}
              <div className="mt-8 flex justify-center md:justify-start gap-4">
                  {[1,2,3].map(i => (
                      <div key={i} className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-site-soft hover:text-primary transition-colors cursor-pointer">
                          <Share2 className="size-4" />
                      </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal
        as="section"
        className="mx-auto mt-12 max-w-4xl px-6 md:mt-16"
      >
        <div className="rounded-3xl border border-slate-900 bg-slate-900 p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-primary/20 rounded-full blur-3xl transition-transform duration-1000 group-hover:scale-150" />
            <div className="relative z-10">
                <p
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary"
                data-tina-field={nextStepKicker.field}
                >
                <MessageSquare className="size-4" />
                <span>{nextStepKicker.value}</span>
                </p>
                <h2 className="text-white mt-4 text-2xl md:text-4xl font-bold max-w-2xl leading-tight">
                <KeywordGradientText
                    dataTinaField={nextStepHeading.field}
                    text={nextStepHeading.value}
                />
                </h2>
                <p
                className="text-site-soft mt-6 text-base md:text-lg max-w-xl leading-relaxed"
                data-tina-field={nextStepBody.field}
                >
                {nextStepBody.value}
                </p>

                <div className="mt-10 flex flex-wrap gap-4">
                <QuoteAwareLink
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-accent hover:scale-[1.02] active:scale-95 shadow-xl shadow-primary/20"
                    data-tina-field={tinaField(site.header, "quoteCta")}
                    forceQuoteModal
                    href={quoteHref}
                    quoteLabel={quoteLabel}
                >
                    <span>{quoteLabel}</span>
                    <ArrowRight className="size-4" />
                </QuoteAwareLink>

                <QuoteAwareLink
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/10 hover:scale-[1.02] active:scale-95"
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
            </div>
        </div>
      </Reveal>
    </main>
  );
}
