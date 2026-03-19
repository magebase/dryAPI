import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WebPageJsonLd } from "@/components/site/seo-jsonld";
import { TinaBlogPostPage } from "@/components/site/tina-blog-post-page";
import { TinaRoutePage } from "@/components/site/tina-route-page";
import { getLatestDeapiPricingSnapshot } from "@/lib/deapi-pricing-store";
import { isManualBlogEnabled } from "@/lib/feature-flags";
import { buildTakumiMetadata, normalizeSiteUrl } from "@/lib/og/metadata";
import {
  filterPricingSnapshotToActiveModels,
  listActiveRunpodModels,
} from "@/lib/runpod-active-models";
import {
  listBlogPosts,
  listRoutePages,
  readBlogPost,
  readRoutePage,
  readSiteConfig,
  routeSlugToRelativePath,
} from "@/lib/site-content-loader";
import {
  tinaBlogPostQuery,
  tinaRoutePageQuery,
  tinaSiteConfigQuery,
} from "@/lib/tina-documents";

type CatchAllPageProps = {
  params: Promise<{ slug: string[] }>;
};

function toPath(slug: string[]) {
  return `/${slug.join("/")}`;
}

function isBlogPostPath(slug: string[]) {
  return slug.length === 2 && slug[0] === "blog";
}

const CATEGORY_TO_PLAYGROUND: Record<string, string> = {
  "text-to-image": "/playground/text-to-image",
  "image-to-image": "/playground/image-to-image",
  "image-to-text": "/playground/image-to-text",
  "image-to-video": "/playground/image-to-video",
  "text-to-speech": "/playground/text-to-speech",
  "text-to-music": "/playground/text-to-music",
  "video-to-text": "/playground/video-to-text",
  "text-to-embedding": "/playground",
  "image-upscale": "/playground/image-to-image",
  "background-removal": "/playground/image-to-image",
  "text-to-video": "/playground/image-to-video",
};

function resolveActiveModelForBlogPost(
  tags: string[],
): { displayName: string; playgroundHref: string } | null {
  const modelTag = tags.find((t) => t.startsWith("model:"));
  if (!modelTag) return null;
  const slug = modelTag.slice("model:".length).trim();
  if (!slug) return null;

  const activeModels = listActiveRunpodModels();
  const match = activeModels.find((m) => m.slug === slug);
  if (!match) return null;

  const category = match.categories[0] ?? "";
  const playgroundHref = CATEGORY_TO_PLAYGROUND[category] ?? "/playground";

  return { displayName: match.displayName, playgroundHref };
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

function toIsoDate(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function resolveTemplateForPath(pathname: string) {
  if (pathname.startsWith("/blog")) {
    return "blog" as const;
  }

  if (pathname.startsWith("/pricing") || pathname === "/plans") {
    return "pricing" as const;
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/account")) {
    return "dashboard" as const;
  }

  return "marketing" as const;
}

export async function generateStaticParams() {
  const [pages, posts] = await Promise.all([listRoutePages(), listBlogPosts()]);
  const manualBlogEnabled = isManualBlogEnabled();

  return [
    ...pages
      .filter((page) => manualBlogEnabled || page.slug !== "/blog")
      .map((page) => ({
        slug: page.slug.replace(/^\//, "").split("/"),
      })),
    ...(manualBlogEnabled
      ? posts.map((post) => ({
          slug: ["blog", post.slug],
        }))
      : []),
  ];
}

export async function generateMetadata({
  params,
}: CatchAllPageProps): Promise<Metadata> {
  const { slug } = await params;
  const manualBlogEnabled = isManualBlogEnabled();
  const site = await readSiteConfig();
  const siteName = site.brand.name || site.brand.mark;

  if (isBlogPostPath(slug) && !manualBlogEnabled) {
    return {};
  }

  if (isBlogPostPath(slug)) {
    const post = await readBlogPost(slug[1]);

    if (!post) {
      return {};
    }

    const siteUrl = normalizeSiteUrl();
    const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath);
    const canonicalUrl = `${siteUrl}${canonicalPath}`;
    const publishedTime = toIsoDate(post.publishedAt);
    const keywords = post.seoKeywords.length > 0 ? post.seoKeywords : post.tags;
    const baseMetadata = buildTakumiMetadata({
      title: post.seoTitle,
      description: post.seoDescription,
      canonicalPath,
      template: "blog",
      siteName,
      keywords,
      authors: [{ name: post.author.name }],
      robots: post.noindex
        ? {
            index: false,
            follow: false,
          }
        : {
            index: true,
            follow: true,
          },
      openGraphType: "article",
      label: "Blog Post",
      seed: `blog-post:${post.slug}`,
    });

    return {
      ...baseMetadata,
      openGraph: {
        ...baseMetadata.openGraph,
        type: "article",
        url: canonicalUrl,
        publishedTime,
        authors: [post.author.name],
        tags: post.tags,
      },
    };
  }

  const page = await readRoutePage(toPath(slug));

  if (!page) {
    return {};
  }

  if (!manualBlogEnabled && page.slug === "/blog") {
    return {};
  }

  if (page.slug === "/blog") {
    const siteUrl = normalizeSiteUrl();
    const baseMetadata = buildTakumiMetadata({
      title: page.seoTitle,
      description: page.seoDescription,
      canonicalPath: page.slug,
      template: "blog",
      siteName,
      label: "Blog",
      seed: "blog-index",
    });

    return {
      ...baseMetadata,
      alternates: {
        ...baseMetadata.alternates,
        types: {
          "application/rss+xml": `${siteUrl}/blog/feed.xml`,
          "application/atom+xml": `${siteUrl}/blog/feed.atom`,
          "application/feed+json": `${siteUrl}/blog/feed.json`,
        },
      },
    };
  }

  return buildTakumiMetadata({
    title: page.seoTitle,
    description: page.seoDescription,
    canonicalPath: page.slug,
    template: resolveTemplateForPath(page.slug),
    siteName,
    label:
      page.slug.startsWith("/pricing") || page.slug === "/plans"
        ? "Pricing Page"
        : "Marketing",
    seed: `route:${page.slug}`,
  });
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const { slug } = await params;
  const manualBlogEnabled = isManualBlogEnabled();
  const site = await readSiteConfig();

  if (isBlogPostPath(slug)) {
    if (!manualBlogEnabled) {
      notFound();
    }

    const post = await readBlogPost(slug[1]);

    if (!post) {
      notFound();
    }

    const activeModel = resolveActiveModelForBlogPost(post.tags);
    const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath);

    return (
      <>
        <WebPageJsonLd
          breadcrumbs={[
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: canonicalPath },
          ]}
          description={post.seoDescription}
          path={canonicalPath}
          scriptId={`blog-post-${post.slug}`}
          title={post.seoTitle}
        />
        <TinaBlogPostPage
          activeModel={activeModel ?? undefined}
          postDocument={{
            query: tinaBlogPostQuery,
            variables: { relativePath: `${slug[1]}.json` },
            data: { blogPosts: post },
          }}
          siteDocument={{
            query: tinaSiteConfigQuery,
            variables: { relativePath: "site-config.json" },
            data: { siteConfig: site },
          }}
        />
      </>
    );
  }

  const page = await readRoutePage(toPath(slug));

  if (!page) {
    notFound();
  }

  const isProductsIndex = page.slug === "/products";
  const isBlogIndex = page.slug === "/blog";

  if (!manualBlogEnabled && isBlogIndex) {
    notFound();
  }

  const productPages = isProductsIndex
    ? (await listRoutePages()).filter((routePage) =>
        routePage.slug.startsWith("/products/"),
      )
    : [];
  const blogPosts =
    isBlogIndex && manualBlogEnabled ? await listBlogPosts() : [];
  const deapiPricingSnapshot =
    page.slug === "/pricing" ? await getLatestDeapiPricingSnapshot() : null;
  const filteredDeapiPricingSnapshot = deapiPricingSnapshot
    ? filterPricingSnapshotToActiveModels(deapiPricingSnapshot)
    : null;
  const relativePath = routeSlugToRelativePath(page.slug);

  if (!relativePath) {
    notFound();
  }

  return (
    <>
      <WebPageJsonLd
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: page.navLabel, path: page.slug },
        ]}
        description={page.seoDescription}
        path={page.slug}
        scriptId={`route-page-${page.slug}`}
        title={page.seoTitle}
      />
      <TinaRoutePage
        blogPosts={blogPosts}
        deapiPricingSnapshot={filteredDeapiPricingSnapshot}
        pageDocument={{
          query: tinaRoutePageQuery,
          variables: { relativePath },
          data: { routePages: page },
        }}
        productPages={productPages}
        siteDocument={{
          query: tinaSiteConfigQuery,
          variables: { relativePath: "site-config.json" },
          data: { siteConfig: site },
        }}
      />
    </>
  );
}
