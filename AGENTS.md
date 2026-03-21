# DO NOT WRITE FALLBACKS: fail fast on unexpected states, prohibit/minimize impossible-state guards, remove legacy/deprecated flags and symbols, allow breaking changes during development, and delete superseded code/docs instead of keeping shims

Project: dryAPI unified AI inference platform
Stack: Next.js App Router, TypeScript, TinaCMS, Fumadocs, Tailwind CSS, ShadCN UI, Cloudflare Workers/OpenNext, Stripe, Vitest

Reference goals:

- Keep landing and dashboard UX fast and conversion-focused.
- Keep content editable in TinaCMS where CMS content powers marketing pages.
- Ship OpenAI/OpenRouter-compatible API surfaces with safe auth, billing, and rate limits.

## Core Product Intent

- Build a dryAPI-style platform that unifies model inference behind one API and one dashboard.
- Route inference requests through Cloudflare Workers to serverless GPU providers (RunPod first).
- Provide prepaid/subscription billing with Stripe and usage-based credit deduction.
- Preserve operational safety: stable routing, no auth regressions, predictable API behavior.

## High-Level Architecture

- Frontend: Next.js + OpenNext
  - SSR for landing/docs/dashboard shell.
  - Client interactivity for playground and usage views.
- API Gateway: Cloudflare Workers
  - JWT/API-key bearer auth.
  - Rate limiting per user/key/model.
  - OpenAI/OpenRouter-style endpoints and model catalog.
- Inference: RunPod serverless GPU endpoints
  - Containerized model runners.
  - Forward requests from worker layer and normalize responses.
- Billing: Stripe
  - Credits, subscriptions, webhook-driven balance updates.
- State and storage:
  - Cloudflare KV / Durable Objects for keys, limits, counters, and balances.
  - Cloudflare Analytics Engine (Wrangler dataset bindings) for high-cardinality per-request pricing and margin telemetry.
  - Cloudflare D1 for current pricing state and snapshots (`price_key`, active quote, refresh state), not raw high-volume pricing event streams.
  - R2 or S3-compatible storage for generated assets and signed URLs.

## Repo Map

- App routes: `src/app/**`
- Docs app routes: `src/app/docs/**`, `src/app/[lang]/docs/**`
- Site components: `src/components/site/**`
- Docs components: `src/components/docs/**`
- API routes (Next runtime): `src/app/api/**`
- Docs source config: `source.config.ts`
- Docs MDX source: `src/content/**`
- Docs loader and i18n wiring: `src/lib/docs/source.ts`
- MDX component registry: `mdx-components.tsx`
- Tina config/schema: `tina/config.js`, `tina/config.ts`
- Tina backend route: `src/pages/api/tina/[...routes].ts`
- Content source: `content/**/*.json`
- Content validation/loading: `src/lib/site-content-loader.ts`, `src/lib/*schema*.ts`
- dryAPI docs mirror + OpenAPI snapshot: `docs/deapi-mirror/**`
- Docs sync script: `scripts/sync-deapi-docs.ts`
- Cloudflare container package: `cloudflare/container/**`
- Cloudflare workflows package: `cloudflare/workflows/**`

## Core API Surface (Target)

- `GET /api/v1/client/balance`: return current available credits.
- `GET /api/v1/models`: list available models and capabilities.
- `POST /api/v1/inference`: dispatch normalized inference request.
- `GET /api/v1/usage`: return usage history and cost breakdown.
- `POST /api/v1/keys`, `DELETE /api/v1/keys/:id`: key lifecycle.

Compatibility requirements:

- Keep request/response shapes compatible with OpenAI/OpenRouter style where intended.
- Return consistent error objects and status codes (`401`, `402`, `429`, `5xx`) with actionable messages.
- Include rate limit headers when throttling (`X-RateLimit-*`, `Retry-After`).

## Commands

- Dev (Tina + Next): `pnpm dev`
- Dev (Next only): `pnpm dev:next`
- Docs sync: `pnpm docs:sync:deapi`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- Tina build: `pnpm tina:build`
- Production build (Tina + Next/OpenNext flow): `pnpm build:tina`
- Cloudflare build: `pnpm cf:build`
- Cloudflare deploy: `pnpm cf:deploy`

## Utility Libraries and i18n

- Use `nuqs` for query-string state in App Router pages and client components; prefer it over custom URL parsing or serialization.
- Use `lodash` for focused data/object utilities when native JS is verbose or error-prone.
- Prefer path imports to keep bundle impact low, for example:
  - `import get from "lodash/get"`
  - `import uniqBy from "lodash/uniqBy"`
- Avoid bringing in full-lodash helpers for simple native operations (`map`, `filter`, `reduce`, `Object.keys`, optional chaining).
- Use `date-fns` for date parsing, formatting, and arithmetic.
- Keep date handling explicit and deterministic:
  - Parse inputs first (`parseISO`) before formatting.
  - Use clear formatting tokens (`format(date, "yyyy-MM-dd HH:mm")`).
  - Use helper functions like `addDays`, `subHours`, `differenceInMinutes` instead of manual millisecond math.
- For localization and number/date internationalization behavior, follow MDN guidance:
  - `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization`
- Prefer built-in `Intl` APIs for locale-aware formatting in UI and API responses, and use `date-fns` for non-locale date math/composition.
- Use `zod` for schema validation and canonical request parsing, `@tanstack/react-form` for typed forms, `@tanstack/react-query` for client mutations/cache, `next-seo` for JSON-LD, and `next-safe-action` for typed server-action wrappers when needed.
- Prefer package-provided behavior over bespoke helpers when a package already exists in `package.json`; consult [docs/package-use-case-guide.md](docs/package-use-case-guide.md) before introducing new utility code.

## Working Rules

- Favor small, testable, low-regression changes over broad rewrites.
- Keep changes scoped to the request; avoid opportunistic refactors.
- Do not introduce formatting-only churn.
- Always commit all validated repository changes and push them to the current remote branch.
- Prefer existing packages in `package.json` over custom helpers when they cover the problem cleanly; the package guide is the first reference for choosing a dependency.
- For `pnpm` script entrypoints in this repository, use TypeScript files (`.ts`) only. Do not add or call `.mjs`, `.cjs`, or custom `.js` script files.
- Preserve existing Tina preview/edit paths (`/admin/index.html`, Tina API routes).
- If schema changes are required, follow schema-first workflow:
  - Update `tina/config.js` first.
  - Update rendering and `content/**/*.json` together.

## Multi-Brand Platform Guidelines

This repo supports multiple public brands and domains from one codebase. Brand work must preserve the shared AI API platform while allowing differentiated positioning, visual identity, and pricing.

### Brand Identity Source of Truth

- Treat `content/site/brands.json` as the registry of supported brands, domains, personas, focus keywords, and brand-scoped database names.
- Resolve the active brand through `src/lib/brand-catalog.ts` using `SITE_BRAND_KEY`, `DRYAPI_BRAND_KEY`, or hostname matching. Do not create parallel brand-resolution logic in routes, components, emails, or scripts.
- Keep brand keys stable, lowercase, and URL-safe. Use the brand key as the join point across content, pricing, SEO, email, analytics, and billing flows.
- Store brand-specific overrides under `content/brands/<brandKey>/**`. Keep shared defaults in `content/site/**`, `content/pages/**`, and `content/blog/**`.
- Use `src/lib/site-content-loader.ts` for brand-aware content reads. Prefer data overrides over branching UI logic.

### Shared Product Surface, Brand-Specific Packaging

- All brands should offer the same core AI API products and services, plus compatible API contracts, unless a task explicitly requires a brand-specific exception.
- Preserve the shared model catalog and routing behavior where `sharedModels.enabled` is true. Do not fork provider or model logic just to change branding, persona, or price presentation.
- Different brands may vary pricing, plan names, included credits, support language, CTA copy, persona framing, and sales motion.
- When price differences are required, implement them as brand-aware content or configuration, not hardcoded literals spread across marketing pages, dashboards, checkout routes, or emails.
- Do not let one brand's promotional language, price points, or packaging leak into another brand's site, docs, checkout, or lifecycle messaging.

### Brandifying Components and ShadCN Theme

- Keep component structure shared across brands. Brandify through props, content, tokens, and helper functions before creating brand-specific component forks.
- Prefer semantic design tokens and CSS variables for brand accents, gradients, marks, and illustration treatments so ShadCN/Tailwind primitives stay reusable.
- ShadCN theme changes must be token-driven. Adjust brand colors, accent surfaces, and visual identity through shared theme variables instead of duplicating component markup or utility-class trees.
- When a visible surface renders the brand wordmark or `brand.mark`, pair it with the shared `BrandLogo` lockup and the brand display name together. Do not render the wordmark alone in headers, cards, CTAs, success screens, or empty states unless the surface is metadata, structured data, or another machine-readable context.
- Keep neutral surfaces, forms, tables, and skeleton loaders visually consistent across brands unless a deliberate brand-level design requirement says otherwise. Loading skeletons remain neutral gray.
- Isolate brand-specific logos, marks, and hero visuals in content/configuration or dedicated assets instead of embedding them into generic UI primitives.
- If a component needs brand-specific copy or styling, pass a normalized brand object or theme data into the shared component, or resolve brand-aware site config at the boundary.
- Avoid `if (brandKey === "...")` branching inside low-level primitives when the same outcome can be achieved by content, tokens, or a higher-level brand wrapper.

### Marketing Pages and Public Copy

- Marketing pages may vary headline, proof points, CTA language, comparison framing, persona targeting, and pricing emphasis per brand while reusing the same layouts and section components.
- Keep public route structure and navigation broadly consistent across brands unless there is a deliberate go-to-market reason to diverge.
- Brand-specific landing pages should emphasize the active brand persona and focus keywords without changing core platform claims beyond what the product actually supports.
- Reuse shared section shells for hero, proof, API examples, pricing, trust, and CTA blocks. Brandify with content, visuals, and tokens instead of page rewrites.
- Do not hardcode one brand's name, domain, contact details, or pricing language into reusable marketing components.

### Brand SEO and Metadata

- Every brand must emit its own canonical URLs, `metadataBase`, sitemap/robots host, Open Graph metadata, feed links, manifest metadata, and structured-data URLs based on the active domain.
- Brand SEO should follow the active brand's `siteUrl`, `displayName`, persona, and focus keywords from the brand and site-content registry. Do not reuse another brand's canonical domain or keyword cluster.
- Keep product and service claims consistent across brands. Differentiate who the brand is for and how offers are packaged, not what the API can do, unless the product actually differs.
- Avoid duplicate-content SEO mistakes by ensuring titles, descriptions, headings, and internal links are brand-aware where pages target different personas.
- When generating marketing or blog metadata, prefer brand-aware loaders and helpers over direct single-domain fallbacks when the page is intended to vary by brand.

### Brand-Aware Emails

- All transactional and marketing emails must resolve branding through the shared email branding layer in `src/emails/brand.ts`, or a thin wrapper around it.
- Keep email structure reusable across brands. Vary mark, sender identity, support/sales addresses, announcement text, URLs, price points, and accent theme through brand data.
- Do not hardcode `dryAPI`, `dryapi.dev`, or fixed sender addresses in reusable email templates or send paths.
- Checkout, billing, onboarding, and support emails must link back to the active brand's domain plus the corresponding dashboard, docs, pricing, and contact routes.
- Brand-specific price points or plan packaging mentioned in emails must match the active brand's public pricing and checkout behavior.

## SEO and Structured Data Standards (Strict)

This project uses Next.js App Router. Use the built-in `generateMetadata` / `export const metadata` API for all standard meta tags (title, description, canonical, OG, Twitter). Use `next-seo` JSON-LD components for structured data. Both are already installed and in active use.

### Core Rule: Every Unauthenticated Page Requires Full SEO Coverage

Every route accessible without authentication **must** include all of the following:

- `title` — concise, brand-aware, ≤ 60 characters including site name.
- `description` — benefit-first, 120–160 characters, matches page intent.
- `alternates.canonical` — absolute URL for the page, brand-aware via `normalizeSiteUrl()`.
- `openGraph` block — `type`, `title`, `description`, `url`, `siteName`, `images` with explicit `width`, `height`, and `alt`.
- `twitter` block — `card: "summary_large_image"`, `title`, `description`, `images`.
- Appropriate JSON-LD structured data via `next-seo` components (see page-type rules below).

Authentication-gated pages (`/dashboard/**`, `/account/**`, success pages, API routes) must set `robots: { index: false, follow: false }` and **must not** include OG or JSON-LD.

### Metadata Requirements by Field

```ts
// Required shape for every public page — fill all fields
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = normalizeSiteUrl(); // always brand-resolved
  const site = await readSiteConfig();

  return {
    title: "Page Title | Brand Name", // ≤ 60 chars
    description: "Benefit-first description ...", // 120–160 chars
    keywords: ["keyword a", "keyword b"],
    alternates: { canonical: `${siteUrl}/path` }, // absolute, no trailing slash
    metadataBase: new URL(siteUrl), // required at layout level
    openGraph: {
      type: "website", // or "article", see below
      url: `${siteUrl}/path`,
      title: "Open Graph Title",
      description: "Open Graph description",
      siteName: site.brand.displayName,
      images: [
        {
          url: `${siteUrl}/og/default.png`, // 1200×630 recommended
          width: 1200,
          height: 630,
          alt: "Descriptive alt text",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Twitter Card Title",
      description: "Twitter card description",
      images: [`${siteUrl}/og/default.png`],
    },
  };
}
```

### OG Image Standards

- Default OG image dimensions: **1200 × 630 px**, `type: "image/png"`.
- Always provide explicit `width`, `height`, and `alt` on every OG image object.
- Use brand-resolved images; never hardcode one brand's asset path in shared components.
- Dynamic pages (blog posts, model pages) must include the page-specific `ogImage` when available, with a brand fallback.
- Never reference `source.unsplash.com` directly — the `normalizeSiteImageSrc` helper already blocks these.

### Twitter Card Standards

- Always use `"summary_large_image"` for content pages.
- Twitter reads `og:title`, `og:image`, and `og:description` — omit `twitter:title`, `twitter:image`, `twitter:description` to avoid duplication (next-seo handles this automatically when using the `NextSeo` component; for `generateMetadata`, set them explicitly only if they differ from OG values).

### JSON-LD Structured Data (next-seo)

Use `next-seo` JSON-LD components in `page.tsx` files (not `layout.tsx` or `head.tsx`). Always pass `useAppDir={true}` when inside the App Router.

Assign stable, unique `scriptId` values to each component to prevent duplicate script injection.

**Homepage / root layout** — `OrganizationJsonLd` + `LocalBusinessJsonLd`:

```tsx
import { OrganizationJsonLd } from "next-seo";

<OrganizationJsonLd
  useAppDir
  type="Organization"
  id={`${siteUrl}/#organization`}
  name={site.brand.displayName}
  url={siteUrl}
  logo={`${siteUrl}/logo.png`}
  sameAs={[site.brand.twitterUrl, site.brand.linkedInUrl].filter(Boolean)}
  scriptId="site-organization-jsonld"
/>;
```

**Blog post page** — `ArticleJsonLd` with `type="BlogPosting"`:

```tsx
import { ArticleJsonLd } from "next-seo";

<ArticleJsonLd
  useAppDir
  type="BlogPosting"
  url={`${siteUrl}/blog/${post.slug}`}
  title={post.seoTitle}
  images={post.ogImage ? [post.ogImage] : []}
  datePublished={post.publishedAt} // ISO 8601
  dateModified={post.updatedAt ?? post.publishedAt}
  authorName={[
    {
      name: post.author.name,
      url: `${siteUrl}/blog/authors/${post.author.slug}`,
    },
  ]}
  publisherName={site.brand.displayName}
  publisherLogo={`${siteUrl}/logo.png`}
  description={post.seoDescription}
  isAccessibleForFree
  scriptId={`blog-post-jsonld-${post.slug}`}
/>;
```

**Pricing page** — `WebPageJsonLd` + `BreadcrumbJsonLd`:

```tsx
import { WebPageJsonLd, BreadcrumbJsonLd } from "next-seo"

<BreadcrumbJsonLd
  useAppDir
  itemListElements={[
    { position: 1, name: "Home",    item: siteUrl },
    { position: 2, name: "Pricing", item: `${siteUrl}/pricing` },
  ]}
  scriptId="pricing-breadcrumb-jsonld"
/>
<WebPageJsonLd
  useAppDir
  id={`${siteUrl}/pricing`}
  description="Model pricing in USD with per-token and per-request cost breakdowns."
  scriptId="pricing-webpage-jsonld"
/>
```

**Model detail page** — `WebPageJsonLd` + `BreadcrumbJsonLd` + optionally `SoftwareAppJsonLd`:

```tsx
import { WebPageJsonLd, BreadcrumbJsonLd } from "next-seo"

<BreadcrumbJsonLd
  useAppDir
  itemListElements={[
    { position: 1, name: "Home",        item: siteUrl },
    { position: 2, name: "Models",      item: `${siteUrl}/models` },
    { position: 3, name: categoryLabel, item: `${siteUrl}/models/${categorySlug}` },
    { position: 4, name: modelName,     item: `${siteUrl}/models/${categorySlug}/${modelSlug}` },
  ]}
  scriptId={`model-breadcrumb-jsonld-${modelSlug}`}
/>
<WebPageJsonLd
  useAppDir
  id={`${siteUrl}/models/${categorySlug}/${modelSlug}`}
  description={modelDetail?.summary ?? `${modelName} model deployment guide.`}
  scriptId={`model-webpage-jsonld-${modelSlug}`}
/>
```

**Docs/API reference pages** — `TechArticleJsonLd` via raw script or `ArticleJsonLd` with section:

```tsx
import { ArticleJsonLd } from "next-seo";

<ArticleJsonLd
  useAppDir
  type="TechArticle"
  url={`${siteUrl}/docs/${slug}`}
  title={doc.title}
  images={[]}
  datePublished={doc.datePublished ?? "2024-01-01"}
  authorName={[{ name: site.brand.displayName, url: siteUrl }]}
  publisherName={site.brand.displayName}
  publisherLogo={`${siteUrl}/logo.png`}
  description={doc.description}
  scriptId={`doc-jsonld-${slug}`}
/>;
```

**FAQ / help pages** — `FAQPageJsonLd`:

```tsx
import { FAQPageJsonLd } from "next-seo";

<FAQPageJsonLd
  useAppDir
  mainEntity={faqs.map((f) => ({
    questionName: f.question,
    acceptedAnswerText: f.answer,
  }))}
  scriptId="faq-jsonld"
/>;
```

### Robots and Indexing Rules

| Route pattern                         | `robots` setting                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| All public marketing pages            | `{ index: true, follow: true }` (default, can omit)                           |
| `/dashboard/**`, `/account/**`        | `{ index: false, follow: false }`                                             |
| `/api/**`                             | Not applicable (API routes)                                                   |
| `/success`, `/verify/**`, `/reset/**` | `{ index: false, follow: false }`                                             |
| Paginated duplicates (`?page=2`)      | Set `alternates.canonical` to page-1 URL                                      |
| Staging / preview environments        | Handle via `X-Robots-Tag: noindex` at middleware level, not per-page `robots` |

### Canonical URL Rules

- Always use absolute, brand-resolved canonical URLs.
- Derive the base via `normalizeSiteUrl()` — never interpolate `process.env.NEXT_PUBLIC_SITE_URL` directly in page files.
- For paginated list pages, canonical must point to the first page (`/blog`, not `/blog?page=1`).
- Dynamic segments must produce stable slugs: `/models/{categorySlug}/{modelSlug}` not `/models/chat-completion/gpt-4`.
- For pages that can be reached at multiple paths, always emit the canonical pointing to the preferred path.

### `metadataBase` Requirement

Set `metadataBase` once in the root `src/app/layout.tsx` via `generateMetadata`. All relative OG/Twitter image URLs resolve against this base. Never omit it — Next.js emits a warning and social cards fail silently.

### SEO Anti-Patterns (Forbidden)

- Missing or empty `openGraph.images` array on any public content page.
- `openGraph.images` entries without explicit `width`, `height`, and `alt`.
- Hardcoded domain strings (`"https://dryapi.dev"`, `"https://dryapi.ai"`) in `generateMetadata` — always use `normalizeSiteUrl()`.
- JSON-LD components placed in `layout.tsx` without `scriptId` — this causes duplicate injection on navigation.
- JSON-LD in `head.js` in the App Router — use `page.tsx` only.
- `twitter.card` set to `"summary"` for content pages — always use `"summary_large_image"`.
- Identical `title` and `openGraph.title` when the page has a richer social title opportunity.
- `noindex` set on pages that should be indexed (e.g., pricing, blog, model pages).
- Omitting `alternates.canonical` on dynamic routes — Google may pick the wrong URL as canonical.

## UI and Frontend Guidelines

- Use a crisp, product-forward visual language suitable for AI infrastructure UX.
- Prefer clear section hierarchy:
  - Hero value proposition.
  - Capability tiles.
  - API example/request-response block.
  - Trust/compliance proof.
  - CTA.
- Use ShadCN/Tailwind primitives consistently.
- Keep mobile-first spacing and typography; avoid desktop-only assumptions.
- Use icons more often where they improve scanning speed and comprehension:
  - Prioritize nav items, section headers, CTA rows, metadata chips, status blocks, and feature lists.
  - Prefer `lucide-react` icons and keep sizing consistent (`size-4` inline, `size-5` for emphasis).
  - Pair icons with text labels (avoid ambiguous icon-only affordances unless accessibility labels are explicit).

### Form Architecture Standards (Strict)

Use a single modern form stack across product surfaces:

- `TanStack Form` for typed client form state.
- `Zod` for validation schemas and canonical payload parsing.
- `Server Actions` for secure server-side mutations that require auth context, secrets, or direct DB access.
- `TanStack Query` for client mutation orchestration, cache invalidation, optimistic updates, and dependent refreshes.

#### Required implementation rules

- Every non-trivial interactive form should be implemented with `@tanstack/react-form` plus a `zod` schema.
- Keep validation deterministic:
  - Parse with `safeParse` for client-side field feedback.
  - Parse again on the server boundary (server action or API route) before writes.
- Do not duplicate business rules in ad hoc string checks when a schema can express the rule.
- Keep form defaults explicit and typed; avoid implicit `undefined`-driven behavior in submit payloads.
- Keep loading and submit states explicit (`idle`, `submitting`, `success`, `error`) and user-visible.
- Prefer icon-safe controls and existing ShadCN components for consistency and accessibility.

#### Server Actions vs TanStack Query decision matrix

| Scenario                                         | Use Server Action | Use TanStack Query |
| ------------------------------------------------ | ----------------- | ------------------ |
| Secure DB mutation / secret-backed operation     | Yes               | Optional wrapper   |
| Simple one-off form submit with no optimistic UI | Yes               | Optional           |
| Optimistic updates or cache mutation needed      | No (alone)        | Yes                |
| Dependent views requiring cache invalidation     | Optional          | Yes                |
| Highly interactive client mutation workflow      | Optional          | Yes                |

#### Rule of thumb

- Use `Server Actions` for trust boundaries and sensitive mutations.
- Use `TanStack Query` for client-side mutation lifecycle and cache synchronization.
- Use a hybrid submit path by default for app/dashboard forms:
  - `TanStack Form` handles field state and validation.
  - `useMutation` executes the submit function.
  - The mutation function can call a `Server Action` when security constraints require server-only execution.
  - On success, invalidate or refresh relevant query keys.

#### Public forms vs authenticated dashboard forms

- Public marketing/contact forms may submit to API routes when multipart payloads or anti-abuse middleware are required.
- Authenticated dashboard settings and account mutations should prefer server actions for privileged writes.
- For file uploads, keep transport concerns (multipart/FormData) separate from structured validation schema.

#### Testing expectations for forms

- Add regression tests for schema behavior whenever form validation or payload shape changes.
- For submit path changes, verify:
  - success flow
  - field validation errors
  - server failure handling
  - cache invalidation behavior when Query is used.

### Design Principles and UX Best Practices

- Design for decisions, not decoration. Every section should help users answer: what is this, why should I care, and what do I do next.
- Keep first-screen clarity high: communicate audience, value, and primary action within the first viewport.
- Establish hierarchy with intent:
  - One dominant heading.
  - One primary CTA.
  - Secondary actions visually de-emphasized.
- Improve readability before adding novelty:
  - Strong contrast for key text.
  - Predictable spacing rhythm.
  - Comfortable line lengths.
- Use progressive disclosure for dense information:
  - Start with summary metrics.
  - Reveal detail with drilldowns, accordions, tabs, or linked detail pages.
- Reduce cognitive load in forms and filters:
  - Use clear labels and sensible defaults.
  - Group related controls.
  - Provide an obvious reset path.
- Keep state explicit across interactive views:
  - Loading, error, empty, and success states must each have distinct, actionable UI.
- Prioritize accessibility as part of baseline quality:
  - Keyboard navigable controls.
  - Visible focus rings.
  - WCAG-conscious color contrast.
  - Semantic headings and landmarks.
- Prevent layout instability:
  - Reserve space for dynamic content.
  - Keep loading and loaded geometry aligned.
- Use motion sparingly and purposefully:
  - Short entry transitions that reinforce hierarchy.
  - No decorative animation that delays comprehension.
- Prefer reusable patterns over page-specific hacks:
  - Build shared section shells and companion skeleton components.
  - Brandify through tokens/content, not repeated markup forks.
- Validate across breakpoints and interaction modes:
  - Mobile and desktop visual checks.
  - Keyboard-only navigation checks.
  - Hover and non-hover input paths.
- For field-level value transfer actions (for example API keys, slugs, IDs):
  - Do not render visible `Copy` text on buttons.
  - Use an icon control (`Copy` icon) with accessible labeling (`aria-label`).
  - On success, animate to a green success check icon, then animate back to the default icon after 5 seconds.
  - Secret values generated in the UI must never be visually rendered in plaintext.
  - For API key and webhook secret fields, use disabled password inputs only (`type="password"`), with no reveal/toggle control.
  - These secret password fields must always be non-editable (`disabled`) and paired with an icon-only copy action.
  - Copy actions must copy from the in-memory secret value while keeping the visible field masked at all times.

### CSR Fetching and Loading State Standards (Strict)

- Any UI that depends on client-side fetches must render ShadCN `Skeleton` placeholders while data is loading.
- Skeleton visuals must be neutral gray (not accent/brand blue or other brand colors).
- Use the shared wave-pulse skeleton treatment (`.skeleton-wave-pulse`) so loading states are consistent across dashboard surfaces.
- Skeletons must match the final loaded UI shape exactly:
  - Same container geometry, spacing, and responsive breakpoints.
  - Same card/list row structure, including avatar/icon/title/metadata/action placeholders where applicable.
  - No layout jump between loading and loaded states (prevent cumulative layout shift).
- Do not render mock data, fake values, seeded placeholders, or synthetic records in place of real fetched data.
- During loading, prefer skeleton-only content regions instead of temporary fake text like sample names, prices, or counts.
- Keep state handling explicit for CSR views:
  - `loading`: exact-shape skeletons only.
  - `error`: error state UI with actionable retry.
  - `empty`: real empty-state messaging when fetch succeeds with no data.
  - `success`: real fetched data only.
- For collection views, use a deterministic skeleton count that mirrors expected viewport layout (not random counts).
- For pagination/infinite loading, append row/card skeletons in the same shape as incoming items.
- Keep accessibility intact during CSR fetches:
  - Mark loading regions with `aria-busy` where appropriate.
  - Ensure skeletons do not remove keyboard focus visibility or trap interaction.
- Prefer reusable `*Skeleton` companion components colocated with each major CSR component/page so loading and loaded markup stay in sync.
- Validate both desktop and mobile loading states whenever adding or changing client-side fetched UI.

### Page Transition and Element Animation Standards

- Use CSS-only `@keyframes` entry animations for dashboard and app pages. Avoid JS-driven animation libraries for simple enter effects.
- Register custom animations in the Tailwind v4 `@theme inline` block so they are available as `animate-*` utilities (`--animate-*` tokens).
- Three canonical animation tiers for dashboard UI:
  - `animate-page-in`: applied to the `<main>` page content wrapper in `DashboardShell`; triggers on every route navigation automatically (no JS needed); fast fade + subtle upward slide (200–280ms).
  - `animate-fade-in`: applied to section headings, banners, and standalone cards that appear above-the-fold; medium fade entry (240ms).
  - `animate-slide-up`: applied to individual cards and list items that need staggered entry; use CSS `animation-delay` via `[style]` or Tailwind `delay-*` utilities for stagger effect.
- Keep animation durations short and decisive: entry animations should complete within 300ms. Do not use slow drift-in animations for interactive UI.
- Use `ease-out` or `cubic-bezier(0.22, 1, 0.36, 1)` for snappy, spring-like entries.
- Stagger delays for grid cards: use `50ms` increments per item (`delay-0`, `delay-[50ms]`, `delay-[100ms]`, `delay-[150ms]`).
- All animation utility classes must declare `animation-fill-mode: both` so elements start invisible before animation fires.
- Always add reduced-motion overrides in the `@media (prefers-reduced-motion: reduce)` block.
- Do not animate on every re-render of CSR components; restrict entry animations to the page-level SSR wrapper and static section containers. CSR components use skeleton transitions, not fly-in animations.
- Do not apply `animate-page-in` to individual child elements within a page that already has `animate-page-in`; choose one or the other per nesting level.

### Public Copy Guardrails (Strict)

- Never place implementation notes, author commentary, or SEO/meta explanations in user-facing UI copy.
- Treat all visible headings, labels, helper text, and paragraph content as end-user product copy only.
- Forbidden in public content: phrases like "for SEO", "for implementation clarity", "row context", "internal note", "LLM note", or similar process narration.
- Example of banned copy on public pages:
  - "Detailed Pricing Rows"
  - "Full row context is shown here for SEO and implementation clarity. Prices are listed in USD per scraped permutation."
- If context is only useful to developers/agents, keep it in code comments, docs, commit messages, or internal markdown, not in rendered page content.
- Prefer concise benefit-first wording that answers user intent; remove any sentence that does not add customer value.

## Writing and Markdown Standards (Strict)

Apply these standards to all AI-authored content in this repo, including blogs, markdown docs, articles, and marketing pages.

### Writing Quality Bar

- Write for expert-but-busy readers: high signal, low fluff, immediate value.
- Lead with outcomes, then explain method, then provide evidence or examples.
- Prefer concrete nouns, specific verbs, and measurable claims over abstract language.
- Keep tone confident and precise; avoid hype, filler, and vague promises.
- Every section should answer one clear user intent question.
- Remove lines that do not change a decision, clarify a concept, or reduce risk.

### Voice and Tone by Surface

- Blog posts:
  - Educational, practical, and credibility-first.
  - Use clear scenarios, tradeoffs, and implementation implications.
  - Avoid generic thought-leadership language without operational detail.
- Docs and technical markdown articles:
  - Instructional, deterministic, and unambiguous.
  - Use exact terms, stable naming, and explicit constraints.
  - Optimize for successful first-run execution, not persuasive copy.
- Marketing pages:
  - Benefit-first, concise, and conversion-focused.
  - Pair each claim with proof signals (capability detail, reliability statement, or measurable outcome).
  - Keep language clear enough for non-specialists without losing technical credibility.

### Structure Blueprints

- Blog/article default structure:
  1. Problem framing with stakes.
  2. What good looks like (decision criteria or target state).
  3. Practical framework or step-by-step method.
  4. Real constraints, tradeoffs, and failure modes.
  5. Actionable summary with next-step checklist.
- Docs markdown default structure:
  1. Purpose and scope.
  2. Prerequisites and assumptions.
  3. Step sequence in strict order.
  4. Validation and expected outputs.
  5. Error handling and recovery paths.
  6. Related links and next tasks.
- Marketing page section flow:
  1. Core value proposition.
  2. Capability proof blocks.
  3. Integration/API evidence.
  4. Trust/compliance proof.
  5. CTA with clear action.

### Markdown and MDX Generation Rules

- Use exactly one H1 per document.
- Do not skip heading levels (`##` follows `#`, `###` follows `##`).
- Keep headings descriptive and specific; avoid generic titles like "Overview" unless necessary.
- Use short paragraphs (2-4 sentences) for scanability.
- Use bullet lists for non-sequential points and numbered lists for procedures.
- Keep list items parallel in grammar and scope.
- Use tables only for true comparisons (features, limits, prices, or options).
- Include language identifiers on fenced code blocks (for example `ts`, `bash`, `json`).
- Keep code examples executable and minimal; avoid pseudo-code unless explicitly labeled.
- Wrap file paths, env vars, commands, and literals in inline code formatting.
- Prefer relative internal links for repo/docs content; use stable external sources when needed.
- For MDX components, ensure surrounding text still reads clearly without visual-only assumptions.

### Evidence and Accuracy Rules

- Do not present estimates, assumptions, or roadmap ideas as facts.
- If a claim depends on repo behavior, verify it against current code or config first.
- When numbers are shown (pricing, limits, throughput, token units), ensure unit labels are explicit and consistent.
- Preserve billing unit conventions used by the platform (credit token vs model token vs Stripe minor units).
- Never invent customer logos, certifications, benchmark numbers, or compliance status.
- Prefer a cautious statement over an unverified assertion.

### SEO and Discoverability Rules

- Write for user intent first, SEO second.
- Place primary intent in title, intro, and at least one section heading naturally.
- Use descriptive meta title and description language without keyword stuffing.
- Avoid repetitive phrase stuffing and templated keyword spam.
- Keep slugs short, readable, and semantically aligned with page intent.

### Editorial QA Checklist (Required)

- The first screen communicates who this is for, what it solves, and why it matters.
- Headings form a coherent outline that can be skimmed without body text.
- Claims are specific, defensible, and free from internal/process commentary.
- Steps are executable in order; expected results are stated.
- Markdown is valid, readable in raw form, and renders cleanly in MDX/Fumadocs.
- Copy is concise, non-repetitive, and free of AI-generic phrasing.

### Forbidden Patterns

- Empty intensity phrases ("game-changing", "revolutionary", "next-gen") without evidence.
- Mechanical repetition of the same sentence pattern across sections.
- Long introductions that delay practical content.
- Public-facing references to "SEO intent", "keyword targets", "AI-generated", or implementation commentary.
- Placeholder text, fake metrics, fake testimonials, or synthetic references.

## Reference Theme Prompt (ZeroDrift-Inspired Compliance Landing)

Use the following prompt when the task is to recreate the same visual language, mood, and structure as the provided compliance-site reference. This prompt is intentionally long-form and highly specific so generation quality stays consistent across design and implementation tasks.

```text
Design and implement a premium AI compliance and governance landing page with an editorial, enterprise, high-trust aesthetic. The visual direction must feel minimal but expensive, warm but controlled, modern but not trendy-for-the-sake-of-trendy. The page should combine a strong hero gradient, soft grayscale section canvases, sparse but intentional typography, technical product blocks, and credibility-heavy messaging for regulated institutions.

Core art direction and emotional target:
- Communicate "speed with control" and "modern AI + institutional trust".
- The user should feel: this product is technically advanced, policy-aware, security-forward, and suitable for legal, financial, and enterprise deployment.
- Avoid noisy marketing gimmicks, loud icon spam, cartoonish illustrations, or generic startup SaaS look.
- Keep it restrained, polished, and quietly bold.

Visual identity system:
- Base style: light-mode only, neutral grays, soft white cards, subtle gradients, occasional high-saturation accent moments.
- Hero color mood: warm red-orange to peach gradient with light bloom and atmospheric blur fields.
- Secondary accent moment (later CTA): cool blue to violet-lilac gradient band to create contrast and section rhythm.
- Surfaces should feel layered: page background, section wrappers, elevated cards, and inset content windows.
- Introduce atmospheric depth using very soft radial gradients and low-opacity glow overlays, not heavy shadows.

Typography direction:
- Use expressive, premium grotesk/sans stacks that are not default system choices.
- Preferred families: "Satoshi", "Neue Montreal", "General Sans", "Manrope" (in that spirit).
- Headings: high contrast, slightly tight letter spacing, confident line breaks, large optical scale.
- Body copy: calm, readable, subdued contrast, short line lengths.
- Label text: uppercase micro-labels, subtle tracking increase, low-contrast gray.
- Do not use heavy display gimmicks; keep type modern, clean, and precise.

Spacing and geometry:
- Maintain generous breathing room and clear section cadence.
- Use a centered content column with max width around 1200-1320px on desktop.
- Build rhythm with large vertical spacing blocks between major sections.
- Corners should be soft but not playful (around 10px-16px in most cards).
- Grid should feel strict; asymmetry is welcome only when intentional.

Detailed page structure (top to bottom):

1) Minimal top navigation
- Left: compact logo mark + wordmark.
- Right: 4-6 simple nav links (Platform, Solutions, Developers, Security, Company) and a small utility action.
- Keep nav height compact and quiet.
- Do not over-style nav; it should disappear behind the hero composition.

2) Hero section (primary signature moment)
- Full-width rounded container with warm gradient (deep coral/orange to pale peach).
- Add subtle light bloom and haze overlays to avoid flat color.
- Left content stack:
  - Tiny eyebrow line (e.g., "the only AI compliance layer" style phrasing).
  - Massive multi-line headline: short, sharp, legible, with clear strategic promise.
  - Small primary CTA button with strong contrast.
  - Optional trust micro-row (tiny circular marks, certification indicators, compact proof text).
- Right side can include a small media card or abstract product visual inset.
- Ensure hero copy contrast remains excellent at all breakpoints.

3) Social proof strip
- Immediately below hero, add a horizontal strip of partner/customer logos in monochrome treatment.
- Logos should be in lightly elevated cards or boxes.
- Include a small line above strip indicating credibility (for example: "Backed by teams at...").
- Keep this section concise and clean.

4) Capability section in soft gray canvas
- Section title: clear, functional, low-hype (for example: "Real-Time Enforcement Layer").
- Introduce a 3-column micro-framework row (such as Compose, Guard, Command).
- Follow with alternating media-and-copy blocks:
  - Left copy + right visual card.
  - Then inverted alignment for next block.
- Visual cards should look like product captures inside frosted containers, with subtle gradient backgrounds.
- Copy should focus on practical outcomes: block violations before send, unify policy logic, accelerate approvals.
- CTA buttons should remain compact and understated.

5) Three-card value grid
- Heading centered: outcome-focused statement (for example: "What Fast and Compliant Looks Like").
- Three equal cards with soft gradient placeholders or product snippets.
- Each card includes brief title + one concise supporting sentence.
- Keep iconography optional and restrained.

6) Workflow proof section
- Centered heading (for example: "See It Work").
- Short explanatory paragraph.
- Add a centered UI mock frame (e.g., compose window with policy check indicator).
- Include a tiny, minimal carousel control or pager affordance if needed.

7) Omnichannel coverage section
- Left: heading and supporting copy explaining unified enforcement across channels.
- Right: modular tile matrix for channels/surfaces (Email, Slack, Docs, CRM, etc.).
- Each tile should have compact icon row + short descriptor.
- Background can include faint grid texture to imply systems and structure.

8) Developer and infrastructure section
- Left: copy framing API-first deployment and integration.
- Right: stacked dark code panels (request + response) with syntax color accents.
- Must feel legitimate and implementation-ready, not decorative fake code.

9) Institutional trust section
- Large breathing space with centered statement for regulated industries.
- Minimal body line about certifications, secure architecture, auditability.
- One understated CTA to view trust/security details.

10) Final conversion band
- Full-width rounded gradient band in cool tones (blue -> violet/pink).
- Left: bold final value proposition and short conversion copy.
- Two CTA buttons with clear priority.
- Right: testimonial or proof quote card in high-contrast panel.

11) Structured footer
- Left side: location/contact block and support email/phone.
- Right side: 3-4 link columns (Platform, Solutions, Company, Legal).
- Bottom row: copyright and utility links.
- Keep footer calm and legible; no dense clutter.

Color and tokenization guidance:
- Define explicit CSS variables and use them consistently.
- Example direction (tune as needed):
  - --bg-page: #f2f2f2
  - --bg-section: #ececec
  - --surface: #f8f8f8
  - --surface-strong: #ffffff
  - --text-primary: #111111
  - --text-secondary: #555555
  - --text-muted: #7a7a7a
  - --line-soft: #dfdfdf
  - --hero-a: #f04f33
  - --hero-b: #f39f6a
  - --hero-c: #f6c7a7
  - --cta-cool-a: #2f58d8
  - --cta-cool-b: #c78ce8
- Keep neutral zones dominant; accent gradients should be strategic, not constant.

Component styling specifics:
- Buttons:
  - Primary: dark ink background, light text, compact pill/rounded rectangle.
  - Secondary: light background with dark border or low-contrast fill.
  - Avoid oversized, flashy button treatments.
- Cards:
  - Soft border, subtle elevation, low-noise surfaces.
  - Use layered inner wrappers for screenshot frames.
- Labels and tags:
  - Micro uppercase, muted contrast, precision spacing.
- Inputs/forms (if present):
  - Neutral chrome with clear focus state and enterprise seriousness.

Motion and interaction behavior:
- Use restrained motion with meaningful sequencing.
- Suggested motion language:
  - Hero content: slight upward fade-in on load.
  - Logo strip: soft stagger reveal.
  - Cards: tiny parallax or translateY (2-6px) with opacity transitions.
  - Gradient glows: very slow ambient drift.
- Animation should support readability, not distract.
- Respect reduced-motion preferences.

Imagery and media treatment:
- Prefer product UI captures, neutral diagrams, compliance workflows, and clean interface snippets.
- Avoid stock-photo-heavy layouts.
- If a human photo is used, keep it small and context-driven.
- Visuals should feel documentary/product-real, not abstract for abstraction's sake.

Copywriting tone:
- Confident, precise, low-hype, outcomes-first.
- Emphasize: policy enforcement, regulated workflows, audit readiness, safe acceleration.
- Keep headlines concise and declarative.
- Keep body text short and information-dense.
- Avoid fluffy superlatives and vague AI buzzword clusters.

Responsive behavior requirements:
- Mobile first with no desktop-only assumptions.
- Hero headline should break elegantly on small screens.
- Grids collapse to 1 column or 2 columns depending on section importance.
- Preserve hierarchy and scannability on tablets.
- Keep tap targets accessible and spacing breathable.

Accessibility and quality bar:
- Ensure WCAG-conscious contrast in all text-over-gradient contexts.
- Maintain visible focus states for keyboard navigation.
- Use semantic landmarks and heading order.
- Avoid ultra-light body text on low-contrast surfaces.

Implementation expectations (if generating code):
- Use Next.js + Tailwind + ShadCN-compatible composition patterns.
- Create reusable section components instead of one monolithic file.
- Extract design tokens to CSS variables at root/theme layer.
- Keep class naming and structure clean and maintainable.
- No unnecessary dependencies for simple visuals.

Creative guardrails:
- Do not revert to generic white SaaS template style.
- Do not default to purple-on-white aesthetic for entire page.
- Do not overuse glassmorphism.
- Do not crowd sections with excessive icon rows or feature bullet spam.
- Do not over-animate.

Final acceptance checklist for this style:
- The hero feels unmistakably warm, premium, and compliance-forward.
- Mid-page shifts into restrained gray product storytelling panels.
- The site alternates between credibility, product proof, and actionable conversion.
- Typography feels intentionally chosen and not default.
- Visual hierarchy is strong on both desktop and mobile.
- The page communicates trust, speed, and technical depth in under 10 seconds of scanning.

If a task asks for "this exact style" or "same theme", prioritize this prompt over generic design instructions and preserve its composition, color logic, spacing rhythm, and restrained enterprise tone.
```

## React Email Guidelines

Use these rules for all transactional, lifecycle, internal alert, and marketing/campaign emails in this repo.

### Architecture and Reuse

- Use React Email components with a shared branded layout and shared primitives. Do not build ad hoc one-off email markup per flow when an existing shared block can be reused.
- Keep email templates under `src/emails/**` and separate:
  - brand/theme resolution
  - shared layout/primitives
  - flow-specific templates
- Every template must work as a standalone render with explicit props. Do not make templates depend on browser APIs, client hooks, or runtime-only UI state.
- Prefer `resolveCurrentEmailBranding()` or `buildEmailBranding()` from `src/emails/brand.ts` when a template or sender needs brand URLs, theme tokens, display names, or support addresses.
- Brand identity must come from the existing brand system and site content:
  - `src/lib/brand-catalog.ts`
  - `src/lib/site-content-loader.ts`
  - `content/site/**`
  - `content/brands/**`
- Do not hardcode `dryAPI` into reusable templates when the brand can be derived from current brand/site config.
- Keep the underlying service inventory consistent across brands in reusable email flows. Adjust persona framing, offer packaging, and pricing by brand without inventing unsupported brand-only products in copy.

### Deliverability and Rendering

- Always provide meaningful preview text with `Preview`.
- Always generate both HTML and plain-text email bodies for sends.
- Keep layouts email-safe:
  - single-column primary structure
  - width around 600-640px
  - inline styles only where needed for compatibility
  - no client-side JavaScript
- Prefer light-mode email designs with strong contrast and restrained accents. Do not rely on CSS features with poor email client support.
- Primary CTAs must be obvious and tappable. Keep one primary CTA per email unless the email is explicitly comparison-oriented.
- Include raw URL fallbacks for critical account actions such as verification or password reset.

### Transactional Email Rules

- Transactional emails must be concise, deterministic, and action-first.
- Each transactional email should do one job clearly:
  - verify identity
  - reset password
  - confirm billing action
  - alert on usage/security state
  - confirm support/contact flow state
- Do not bury required actions below long marketing copy.
- Use precise subjects and body copy. Avoid hype in transactional flows.
- Include support contact details when a user may need help completing the action.
- Do not require unsubscribe links in strictly transactional emails.

### Marketing and Campaign Email Rules

- Marketing emails must still be brand-safe, high-signal, and technically credible.
- Required for marketing/campaign emails:
  - unsubscribe link
  - optional manage-preferences link when available
  - clear primary CTA
  - benefit-first headline
- Keep campaigns focused on one theme per send:
  - launch
  - newsletter digest
  - feature announcement
  - re-engagement
  - upgrade offer
- Campaign variants may change price points, persona emphasis, and CTA framing by brand, but they should still describe the same underlying platform capabilities unless the product catalog intentionally differs.
- Avoid deceptive urgency, vague claims, or copy that reads like generic SaaS spam.
- Use short sections, scannable bullets, and proof-oriented copy rather than long prose blocks.

### Internal Alert Emails

- Internal alerts such as contact, quote, and chat escalations should use structured label/value blocks for fast scanning.
- Put the most operationally useful facts first:
  - queue
  - sender/contact details
  - submitted time
  - page/source
  - latest message or transcript excerpt
- Internal emails should still use the shared brand layout, but copy should stay operational, not promotional.

### Security and Privacy

- Never render secrets in plaintext in emails.
- Never email full API keys, bearer tokens, passwords, webhook secrets, or session tokens.
- If a flow references a sensitive value, show only masked identifiers or last-4 style hints where necessary.
- Keep PII limited to what the recipient needs for the action.
- Avoid copying large raw payloads or verbose transcripts into customer-facing emails.

### Content and CTA Standards

- Use plain-language CTA labels such as `Verify email`, `Reset password`, `Open billing`, `Read the launch note`, or `Manage usage`.
- Headings and supporting copy must reflect end-user value, not implementation commentary.
- Do not include internal notes, SEO commentary, or agent-facing instructions in visible email copy.
- Keep subjects and preview text aligned with the actual body action.

### Testing and Verification

- For meaningful email changes, verify:
  - branded content resolves correctly for default and non-default brands
  - HTML render succeeds
  - plain-text render is present and readable
  - critical action links are absolute and correct
  - mobile-friendly spacing remains readable
- Prefer lightweight render tests for shared branding and template output over brittle snapshot spam.
- When updating an active send path, verify the caller passes explicit branding instead of relying on hardcoded brand strings.

## Worker and Inference Guidelines

- Validate and sanitize all untrusted request input at API boundaries.
- Estimate and reserve usage cost before inference dispatch when applicable.
- Handle timeout, cold start, and upstream model errors explicitly.
- Normalize provider-specific payloads into stable response contracts.
- Log request metadata for analytics without leaking secrets/PII.

## Security Best Practices for Cloudflare/OpenNext

- Treat every request header, host value, callback URL, and redirect target as untrusted. Resolve internal fetch origins from explicit configuration such as `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, or `NEXT_PUBLIC_SITE_URL`; do not trust `request.url`, `Host`, or `X-Forwarded-Host` in production when building privileged internal requests.
- Allow only local-path callback URLs for sign-in, sign-up, reset, and verification flows. Reject absolute URLs that point off-site, and strip any external origin before redirecting or persisting the target.
- Put auth in front of every state-changing or secret-bearing route, including upload signing, media mutation, admin utilities, webhook replay helpers, and internal proxy endpoints. Public routes should be read-only unless there is a verified business need.
- Scope R2 keys by purpose and prefix. Upload signing should issue short-lived URLs with exact `Content-Type` and size bounds; delete and list operations must stay inside their own prefix and never accept arbitrary object keys.
- Keep Cloudflare CDN and `r2.dev`/custom CDN exposure aligned with object sensitivity. Public assets may be cached aggressively only when the path is immutable or content-addressed; private or user-specific assets must stay behind signed URLs or an auth gate.
- Pin allowed hostnames and zones in Cloudflare DNS, Workers, and OpenNext routing. Reject unknown brand hosts, do not branch privileged logic on a raw request host, and keep canonical/public URLs sourced from the brand registry.
- Keep Durable Objects single-purpose and tenant-scoped. Use explicit entity keys, never multiplex privileged and public state in one object, and never use a DO as a fallback store for auth, billing, or access-control state.
- Keep D1 segmented by workload. Auth, billing, analytics, and metadata must stay on their dedicated bindings; never fall back from an auth binding to a broader app database, and never co-mingle secret-bearing or high-churn writes with public content reads.
- Use exact CORS and cookie settings for authenticated flows: explicit origins, no wildcard credentials, `HttpOnly`, `Secure`, and `SameSite` matching the trust boundary. Do not relax cookies or CORS to make local development easier.
- Verify every webhook, signed token, and bearer assertion with strict `iss`, `aud`, expiration, and replay checks. Fail closed when a secret, binding, or verification key is missing.
- Keep logs non-sensitive. Never log session tokens, cookies, presigned URLs, full authorization headers, or raw payloads that may contain secrets.
- Every security fix must add a regression test. Prioritize tests for unauthorized access, host spoofing, open redirect handling, cross-prefix object access, and any route that proxies to an internal origin.

Additional gateway and docs guidance:

- Use a single, dedicated Hono-based Cloudflare Worker as the public API gateway. The worker should:
  - Enforce API-key / bearer auth on public endpoints (set via `API_KEY` worker binding).
  - Provide essential middleware: CORS, structured warning/error logging, JSON validation via `zod`, and lightweight rate-limit hooks where appropriate.
  - Expose a machine-readable OpenAPI descriptor at `/openapi.json` for docs and client tooling.
  - Proxy validated requests to the internal Next/OpenNext runtime (configurable via `ORIGIN_URL` and `INTERNAL_API_KEY`) so inference routing and billing logic can remain in server code.

- Docs integration and build-time artifact:
  - The docs site uses Fumadocs with MDX content generated into `src/content/**` by `scripts/sync-deapi-docs.ts` and loaded through `source.config.ts` plus `src/lib/docs/source.ts`.
  - Keep `/docs` and `/[lang]/docs` in sync. Default locale docs stay unprefixed; non-default locales use the prefixed routes.
  - Preserve the local `/openapi.json` Next route as a same-origin mirror of `docs/deapi-mirror/articles/openapi.json` so docs previews work during Next-only development.
  - Keep the interactive OpenAPI preview available through the MDX component registered in `mdx-components.tsx` (example: `src/components/docs/OpenApiViewer.tsx`) and the generated Fumadocs OpenAPI reference under `/docs/v1/api-reference`.
  - Add a prebuild step that generates an `content/llm-text.txt` artifact containing the API base and summary (script: `scripts/generate-llm-text.ts`). The prebuild hook runs before `pnpm build` so the site deploy bundle includes the LLM text.

- Margin-aware dynamic pricing telemetry (required):
  - Use a Wrangler `analytics_engine_datasets` binding as the primary per-request event sink for pricing and cost telemetry.
  - Emit event-level fields required for margin analytics: `price_key`, `surface`, `endpoint_id`, `model_slug`, `revenue`, `estimated_cost`, execution/queue timings, and status.
  - Keep D1 focused on materialized pricing state (current quote/snapshots and refresh bookkeeping), not as the primary high-cardinality event store.
  - Do not use Durable Objects as the default global pricing aggregator; reserve DOs for specialized sub-second coordination use cases only.

- Multi-armed bandit pricing architecture (required):
  - Treat each `price_key` as an independent arm group with configurable candidate multipliers (for example via `RUNPOD_PRICING_BANDIT_ARMS_CSV`).
  - Keep bandit arm statistics in D1 (`runpod_price_bandit_arms`) and current selected arm/config state in D1 (`runpod_price_bandit_state`).
  - Use Worker-side UCB/epsilon-style selection during snapshot recompute to balance exploration and exploitation while respecting margin floors.
  - Persist selected arm identity (`bandit_arm_id`) with snapshots and enqueued jobs so terminal events can attribute rewards to the exact arm that priced the request.
  - Compute reward as weighted margin and growth signals (`alpha * margin + beta * growth`) with env-driven weights (`RUNPOD_PRICING_BANDIT_ALPHA_MARGIN`, `RUNPOD_PRICING_BANDIT_BETA_GROWTH`).
  - Update arm reward totals and EMAs only on terminal job events; never block request dispatch on heavy bandit queries.
  - Enforce guardrails on price movement per refresh window (max step-up / step-down) and always keep selected prices above hard minimum-profit floor prices.
  - Keep Analytics Engine as the canonical high-cardinality event stream for telemetry and future offline model tuning; use RunPod billing API only for delayed coefficient reconciliation.

## RunPod Unit Economics and Profitability Rules

- Treat RunPod serverless cost as GPU-seconds across: startup (boot/load), execution, and idle hold time.
- Keep endpoint-level cost accounting explicit for every request: selected GPU, worker mode (flex/active), runtime seconds, startup seconds, idle seconds, and total provider cost.
- Do not expose raw RunPod endpoints to clients. Always route through our gateway for auth, rate limits, billing, caching, and normalized contracts.
- Keep one model per endpoint to isolate scaling and cost behavior.
- Prefer smallest viable GPU tier per model class:
  - Embeddings and OCR: L4/3090 class when quality/latency is acceptable.
  - Small-medium generation models: 4090 class as default price/perf baseline.
  - Large/high-memory models: A100/H100 only when memory or throughput requires it.
- Use mixed worker pools:
  - Low/variable traffic: `active=0` + flex burst workers.
  - Stable/high traffic: maintain at least one active worker plus flex burst capacity.
- Minimize cold-start penalties with preloaded model artifacts and quantized weights where quality allows.
- Implement request batching when endpoint semantics allow it; keep response ordering deterministic.
- Implement router decisions using measurable signals: queue depth, observed latency, and effective cost per request.
- Cache deterministic or frequently repeated responses (especially embeddings and prompt-derived artifacts) to reduce GPU spend.
- Expose and enforce clear margin guardrails:
  - Compute estimated provider cost before dispatch.
  - Reject or re-route requests that violate floor margin policies unless explicitly overridden.
- Keep pricing and billing credit logic decoupled from provider pricing internals so retail pricing can be tuned without changing routing code.
- Preserve OpenAI/OpenRouter-compatible response shapes and error contracts while applying internal routing optimizations.

## RunPod Revenue Blueprint (OpenRouter/Replicate/Runware Style)

### Highest-Revenue Model Priorities

- Prioritize fast, high-demand model classes with strong unit economics:
  - Image generation first (highest margin): FLUX Schnell/Dev, SDXL, JuggernautXL, RealVisXL.
  - Speech/audio second: Whisper Large v3, WhisperX, MMS TTS.
  - Embeddings third (very high margin, high volume): BGE Large, E5 Large, GTE Large.
  - LLMs as traffic drivers: Llama 3 8B, Mistral 7B, Mixtral.
- Treat image, speech, and embedding endpoints as margin engines; treat chat/LLM endpoints primarily as acquisition and retention paths.

### Required API Platform Shape

- Never expose RunPod endpoint URLs directly to clients.
- Keep strict gateway-first flow:
  - Clients -> our API platform -> request router -> RunPod serverless endpoints -> GPU workers.
- Gateway responsibilities remain mandatory: API keys, auth, billing, rate limits, batching, caching, and contract normalization.
- Maintain OpenAI/OpenRouter-like product-facing surface:
  - `/v1/chat`
  - `/v1/images`
  - `/v1/transcribe`
  - `/v1/embeddings`

### Router and Endpoint Strategy

- Router must choose model, endpoint, and GPU tier per request using measurable signals (queue depth, observed latency, effective cost).
- Keep one model per endpoint to isolate autoscaling and cost behavior.
- Account for full worker lifecycle cost in estimates:
  - startup/load time
  - execution time
  - idle hold time
- Explicitly design for cold starts and fallback paths.

### Profit-First RunPod Configuration

- Configure and store endpoint-level policy for:
  - allowed GPU types and ordered fallback priority
  - min workers and max workers by traffic profile
  - worker mode and autoscaling behavior
- Baseline defaults:
  - Low/variable traffic: `min workers = 0`, small max burst.
  - Stable/high traffic: `min workers = 1`, higher max burst.
- Keep fallback GPU priority to prevent downtime (for example: 4090 -> A6000 -> A100).

### Margin Optimization Tactics (Required Where Applicable)

- Batch compatible requests with deterministic ordering.
- Prefer quantized deployments when quality is acceptable: AWQ, GPTQ, GGUF, bitsandbytes, INT8/NF4/FP8 variants.
- Cache deterministic responses aggressively (especially embeddings and repeatable prompt/image flows).
- Enforce floor-margin guardrails before dispatch:
  - estimate provider cost first
  - reject or reroute requests violating configured margin floor unless explicitly overridden.

### Packaging and Monetization Defaults

- Prefer credit-based plans over per-request public pricing for margin control and simpler packaging.
- Maintain plan archetypes in product configuration (starter/pro/business style tiers) and decouple from raw provider pricing.
- Preserve explicit profitability tracking per request and per endpoint (revenue, provider cost, gross profit, gross margin).

### Scale Targets and Operating Posture

- Aim to scale with high-volume fast models on economical GPUs before expanding expensive large-model coverage.
- Avoid over-hosting heavyweight models without clear demand and margin justification.
- Prioritize throughput, batching, and caching discipline over model count expansion.

## Billing and Auth Guidelines

- Never hardcode secrets or tokens.
- Keep Stripe webhook verification strict.
- Ensure balance updates are idempotent.
- Enforce auth on private endpoints; keep public marketing routes accessible.

## D1 Storage Rules and Best Practices

- Use segmented D1 databases by write workload. Current target bindings:
  - `AUTH_DB`: Better Auth tables (`user`, `session`, `account`, `verification`)
  - `BILLING_DB`: balances/transactions/usage aggregates
  - `ANALYTICS_DB`: quote/moderation and aggregate analytics reads
  - `METADATA_DB`: pricing snapshots, Tina level state, metadata/config tables
- Keep one Drizzle config per D1 database:
  - `drizzle.config.auth.ts`
  - `drizzle.config.billing.ts`
  - `drizzle.config.analytics.ts`
  - `drizzle.config.metadata.ts`
- Keep migration directories split per database under `drizzle/migrations/{auth,billing,analytics,metadata}`.
- `APP_DB` may exist only as a temporary compatibility alias; new code should prefer dedicated bindings above.
- Treat Cloudflare D1 as relational operational storage, not a long-term archive for high-growth cold records.
- Keep strict size guardrails per D1 database and plan ahead for the 10GB limit.
- Any record class that is rarely read and expected to grow fast enough to threaten the D1 10GB limit should be moved out of primary D1 tables.
- For these high-growth cold datasets, choose one of these patterns early:
  - Store them outside D1 (for example in R2/object storage plus indexed metadata pointers).
  - Move them into a separate dedicated D1 database so core transactional tables remain healthy.
- Separate hot-path and cold-path data models:
  - Hot path in primary D1: auth, balances, API keys, routing config, active quotas, recent usage windows.
  - Cold path outside primary D1: raw logs, verbose traces, old usage rows, historical analytics snapshots.
- Prefer retention and compaction over unlimited growth:
  - Add explicit retention windows for event-like tables.
  - Summarize old granular rows into periodic aggregates before archiving.
  - Delete or offload raw historical detail after aggregation is complete and validated.
- Design for predictable query performance under growth:
  - Index only columns used by real filters/sorts; remove speculative indexes.
  - Avoid wide rows when a normalized child table or object-store blob pointer is cleaner.
  - Use pagination and bounded range scans for list endpoints.
- Keep schema migrations safe and observable:
  - Use additive, backwards-compatible migrations first; backfill in controlled steps.
  - Avoid large blocking rewrites during peak traffic windows.
  - Validate row counts and integrity after each migration stage.
- Keep billing and usage correctness resilient to storage tiering:
  - Preserve immutable billing-critical facts before archival.
  - Ensure aggregates used for invoicing/reconciliation are reproducible and auditable.
  - Never let archival jobs mutate already finalized billing periods without explicit reconciliation flow.
- Add operational thresholds and alerts:
  - Track DB size growth, table-level row growth, and query latency over time.
  - Trigger alerts before capacity risk, not after failures.
  - Define runbooks for "split database" and "offload to R2" actions.
- Keep data movement idempotent:
  - Archival/offload jobs must be restart-safe and duplicate-safe.
  - Use checkpoints or high-water marks for batch migration jobs.
  - Verify checksums/count parity between source and destination before deletion.

## Cloudflare D1 Architecture and Separation of Concerns

This document defines how this repository uses Cloudflare D1 for scale, performance, and reliability.

D1 uses SQLite semantics with serialized writes per database. The platform must optimize for read-heavy behavior and constrained write pipelines.

## Core Principles

1. Prefer reads over writes.
2. Minimize per-request writes.
3. Batch and aggregate where possible.
4. Separate D1 databases by write workload.
5. Keep rows and indexes small.
6. Use retention and cleanup for all growth-prone tables.

## Database Segmentation in This Repo

Use dedicated D1 databases with dedicated Drizzle configs and migration directories:

- `AUTH_DB`
  - Drizzle config: `drizzle.config.auth.ts`
  - Migrations: `drizzle/migrations/auth`
  - Tables: `user`, `session`, `account`, `verification`
- `BILLING_DB`
  - Drizzle config: `drizzle.config.billing.ts`
  - Migrations: `drizzle/migrations/billing`
  - Tables: `credit_balance_profiles` and billing state tables
- `ANALYTICS_DB`
  - Drizzle config: `drizzle.config.analytics.ts`
  - Migrations: `drizzle/migrations/analytics`
  - Tables: `quote_requests`, `moderation_rejections`, aggregate usage/reporting tables
- `METADATA_DB`
  - Drizzle config: `drizzle.config.metadata.ts`
  - Migrations: `drizzle/migrations/metadata`
  - Tables: `deapi_pricing_snapshots`, `deapi_pricing_permutations`, `tina_level_entries`, `hot_cold_*`

Compatibility fallback bindings (`APP_DB`, `TINA_DB`) may exist during migration but must not be the long-term primary architecture.

## Table Design Rules

- Keep rows small and bounded.
- Avoid unbounded JSON blobs and log-style append-only tables.
- Index only fields used by real query filters/sorts.
- Prefer aggregate tables over high-cardinality event streams.

## Write Optimization Rules

- Avoid immediate per-request writes for telemetry and counters.
- Prefer buffered batching and periodic flush.
- Use idempotent `UPSERT` patterns for aggregate counters.
- Use D1 `batch` where multiple writes are required in one operation.

## Read Scaling Rules

- Design for SELECT-heavy traffic.
- Cache read-heavy static data in KV/edge cache when possible.
- Good cache candidates:
  - pricing snapshots
  - model metadata
  - public configuration

## Auth DB Rules

- Keep auth DB low-write and highly indexed.
- Session records must expire and be periodically cleaned.
- Do not store large profile payloads in auth tables.

## Billing DB Rules

- Keep billing writes consistent and minimal.
- Avoid per-request balance mutation when an aggregate window is possible.
- Preserve immutable billing-critical facts before archival.

## Snapshot and Metadata Rules

- Snapshot tables are preferred for read-heavy immutable datasets.
- Keep recent snapshots hot in D1 and archive older slices as needed.

## Retention and Cleanup

Each growth-prone table must have explicit retention.

Examples:

- Session cleanup: delete expired sessions on a periodic cadence.
- Pricing snapshots: retain only recent snapshots in hot storage.
- Event-like data: aggregate first, archive or delete raw detail after verification.

## Query Pattern Rules

Prefer:

- indexed predicates
- bounded result sets (`LIMIT`)
- paginated scans

Avoid:

- full-table scans on hot paths
- unbounded list endpoints

## Migration Safety

Follow additive-first rollouts:

1. add new columns/tables
2. deploy app using new structures
3. backfill data in controlled jobs
4. remove old structures only after validation

## Anti-Patterns to Avoid

- every request writes to D1
- D1 as a queue
- D1 as raw high-frequency telemetry store
- large append-only log tables in primary operational DBs

Use batching, aggregation, database segmentation, and edge caching instead.

## Target Envelope

Design around conservative write throughput per database and keep sustained writes below saturation levels. Use additional databases and workload partitioning before approaching write ceilings.

## Testing and Verification Standards

- Principle: follow a test pyramid — many fast unit tests, a moderate number of integration tests, and a small number of end-to-end (E2E) tests. Tests must be automated, deterministic, and run in CI.

- Test Pyramid (recommended):
  - **Unit tests (heaviest):** Fast, isolated, and numerous. Cover pure functions, components, and utility logic. Run with `vitest`/`pnpm test`; colocate tests next to code.
  - **Integration tests (middle):** Exercise interactions between modules, DB, workers, and API layers while keeping external dependencies mocked or using dedicated test fixtures. Use separate integration test jobs and dedicated commands where appropriate.
  - **End-to-end (E2E) tests (thin):** Focus on critical user flows (auth, billing/checkout, inference dispatch). Keep these few, reliable, and expensive — run them on gated CI pipelines or nightly schedules. Use Stagehand + Vitest for browser-based E2E flows; use Vitest with native `fetch` for pure API/worker E2E flows.

- Minimum local/PR checks:
  - Run `pnpm lint` and `pnpm test` before opening a PR.
  - Run relevant integration/E2E commands for the areas you changed (see the Cloudflare integration test command in this doc for worker tests).
  - For UI/layout tasks, verify homepage at common mobile and desktop breakpoints and inspect visual artifacts where available.
  - For API/gateway changes, verify status code behavior and error contracts.
  - For billing changes, test webhook idempotency and balance reconciliation.

- Agent testing responsibilities (required):
  - Agents must run the test suite and add or update tests whenever they make changes (new features, bug fixes, or refactors).
  - For bug fixes, include a regression test that reproduces the bug and verifies the fix.
  - For new features, include unit tests and any necessary integration tests that validate the feature contract.
  - If a test cannot be added (for example an external provider integration that cannot be reliably mocked), document why and provide a validated manual test plan in the PR.
  - Update or remove tests only with explicit justification in the PR; do not update snapshots blindly.

- Best practices:
  - Keep unit tests fast and independent of network or ephemeral services.
  - Use fixtures, factories, and deterministic seeds for integration tests.
  - Mock external APIs in unit tests; use recorded fixtures or dedicated test environments for integration flows.
  - Avoid flakiness: mark, triage, and fix flaky tests quickly; do not let flaky tests silently block the pipeline.
  - Prefer small, focused tests over large monolithic assertions.
  - Co-locate tests with the code they exercise to make maintenance easier.
  - Enforce tests and linting on CI; do not merge failing pipelines.
  - Aim for clear, maintainable assertions and failure messages.

- CI and performance:
  - Partition long-running integration and E2E suites into separate CI jobs (optional gating).
  - Parallelize tests where safe; keep CI run times practical.
  - Add smoke checks to catch regressions quickly in PR pipelines.

- Commands and verification:
  - Quick local checks: `pnpm lint && pnpm test`
  - Cloudflare worker integration: run the recommended integration test command when touching worker code (see the 'Cloudflare API integration test command' section).
  - For browser E2E flows, use Stagehand + Vitest; review console output and any saved screenshots when failures occur.

- PR acceptance:
  - Pull requests must include the test commands used, a short test plan, and evidence that tests pass locally and on CI.

## Stagehand E2E Testing Guidelines

This project uses `@browserbasehq/stagehand` (v3) for browser-based end-to-end automation. Stagehand wraps Playwright with AI-driven natural language actions. It is not a test runner — pair it with Vitest.

### When to use Stagehand

- Use Stagehand for browser-based E2E flows: auth sign-up/sign-in, dashboard interactions, billing/checkout UI, model playground, and account management.
- Do not use Stagehand for pure HTTP API tests. Those stay as Vitest tests with native `fetch`.
- Do not use Stagehand for unit or integration tests — it is expensive, slow, and requires a browser.

### Initialization and teardown

Always initialize once per test file or suite and close after all tests complete.

```ts
import { afterAll, beforeAll, describe, it } from "vitest";
import { Stagehand } from "@browserbasehq/stagehand";

let stagehand: Stagehand;

beforeAll(async () => {
  stagehand = new Stagehand({
    env: "LOCAL", // LOCAL for CI/dev; BROWSERBASE for cloud
    headless: true,
    modelName: "gpt-4o", // or "claude-3-5-sonnet-20241022"
    modelClientOptions: {
      apiKey: process.env["OPENAI_API_KEY"],
    },
    verbose: 0, // set to 1 only during debugging
  });
  await stagehand.init();
});

afterAll(async () => {
  await stagehand.close();
});
```

- Always call `await stagehand.close()` in `afterAll`; failure to do so leaks browser processes.
- Use `env: "LOCAL"` for local development and CI pipelines. Use `env: "BROWSERBASE"` only for remote/cloud runs that require a persistent session or specific browser configuration.
- Use `headless: true` in CI. Never commit `headless: false`.
- Keep `verbose: 0` by default; enable `verbose: 1` only while actively debugging a failing test.

### Core API usage

**`act`** — perform a browser interaction described in plain language:

```ts
await stagehand.act({ action: "click the Sign In button" });
await stagehand.act({
  action: 'fill in the email field with "user@example.com"',
});
await stagehand.act({ action: "submit the login form" });
```

- Keep each `act` call atomic: one logical action per call.
- Be specific enough to be unambiguous but not so verbose that the LLM over-constrains its selector search.
- For sensitive data in `act` strings, pass a variable reference — never construct a string with a real secret or PII inline.

**`extract`** — pull structured data from the current page:

```ts
const result = await stagehand.extract({
  instruction: "extract the current credit balance shown on the billing page",
  schema: z.object({ balance: z.string() }),
});
```

- Always provide a `schema` (Zod) to get typed, validated output.
- Use `extract` for assertions about page state instead of brittle CSS selectors.

**`observe`** — dry-run an action to inspect what Stagehand would do without executing it:

```ts
const actions = await stagehand.observe({
  instruction: "click the top-up button",
});
```

- Use `observe` before `act` when uncertainty is high: unfamiliar pages, dynamic content, or unstable layouts.
- `observe` output is useful for debugging; do not ship tests that rely on it for flow control.

**`page`** — direct Playwright `Page` access for operations that do not need AI:

```ts
await stagehand.page.goto("http://localhost:3000/dashboard");
await stagehand.page.waitForURL("**/dashboard");
const url = stagehand.page.url();
```

- Prefer `page.goto` and `page.waitForURL` for navigation — these are deterministic and do not cost an LLM call.
- Use `page.screenshot` only for debugging; remove screenshot calls before merging.

### Test structure conventions

- One Stagehand instance per `describe` block (or per file for small suites). Do not create a new instance per `it`.
- Navigate to a known starting URL at the start of each `it` to keep tests independent:

```ts
it("should display balance after top-up", async () => {
  await stagehand.page.goto(`${BASE_URL}/dashboard/billing`);
  // ... act + extract assertions
});
```

- Use `vitest`'s `expect` for assertions on extracted data; do not invent custom assertion helpers.
- Keep test data deterministic: use fixed test accounts set up in `globalSetup`, not random state.

### Local vs Browserbase environments

| Setting           | Local (CI/dev)            | Browserbase (cloud)                             |
| ----------------- | ------------------------- | ----------------------------------------------- |
| `env`             | `"LOCAL"`                 | `"BROWSERBASE"`                                 |
| `headless`        | `true`                    | managed by platform                             |
| Required env vars | none (beyond LLM key)     | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` |
| Use case          | unit CI pipeline E2E gate | remote cross-browser, persistent session        |

- Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` via worker secrets or CI environment variables. Never commit them.
- Do not run Browserbase sessions in local dev unless explicitly needed; they are billed per minute.

### Model selection

- Default to `gpt-4o` for general-purpose browser automation tasks.
- Use `claude-3-5-sonnet-20241022` when multi-step reasoning over complex page layouts is needed.
- Do not use models smaller than GPT-4 class for `act` or `extract`; accuracy degrades noticeably on dynamic UI.
- Set the model API key via `modelClientOptions.apiKey` from an environment variable — never hardcode it.

### Security and privacy rules

- Never call `act` with a string that contains a real API key, password, or secret value — use a variable reference for the value and keep the action instruction generic.
- Do not screenshot pages that show account credentials, billing details, or personal data unless the screenshot is ephemeral and debug-gated.
- Do not log `stagehand` instance config objects — they may contain API keys in `modelClientOptions`.
- Keep test-account credentials in environment variables (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`); never hardcode them in test files.

### Performance and flakiness

- Add `page.waitForURL` or `page.waitForSelector` after navigations before issuing `act` or `extract` — Stagehand does not automatically await page stability.
- Cap per-test timeout at 60s for simple flows; 120s for checkout or multi-step flows.
- If a test is consistently flaky, add an `observe` step to inspect what the AI sees before the failing `act`, then tighten the instruction or add an explicit wait.
- Do not retry `act` calls in a loop — fix the instruction instead.

## Guardrails

- Do not manually edit generated artifacts unless explicitly required.
- Keep React keys stable and unique.
- Avoid breaking dynamic route behavior in `src/app/[...slug]/page.tsx`.
- Do not remove existing security middleware behavior without explicit instruction.

## Agent Prompting Guidance

- Specify exact files for changes.
- Include acceptance criteria and constraints.
- Provide literal runtime/build/test errors when debugging.
- Ask for diff summary plus verification steps after implementation.

## Logging and Diagnostics Policy (Strict)

When debugging auth, routing, billing, inference failures, or webhook correctness, logs must be structured, high-signal, and safe.

### Required logging behavior

- Prefer structured logs over free-form strings.
- Log only actionable events by default:
  - Allowed baseline: `console.warn` and `console.error`.
  - Do not add routine request/response lifecycle `console.log` noise.
- `console.log`/`console.info`/`console.debug` are temporary diagnostics only:
  - Must be gated behind explicit debug flags.
  - Must include cleanup/removal before merge unless incident response explicitly requires retention.
- Include a correlation identifier on every related log line:
  - Use `traceId`, request ID, or equivalent propagated value.
- Prefer failure and anomaly events over steady-state milestones.
- For healthy-path telemetry, use metrics/traces instead of frequent console output.

### Console method rules

- `console.log`: disallowed in steady-state runtime paths; temporary debug only behind a flag.
- `console.info`: disallowed in steady-state runtime paths; temporary debug only behind a flag.
- `console.debug`/`console.trace`: disallowed unless incident-scoped and explicitly gated.
- `console.warn`: recoverable problems, retries, non-fatal unexpected states.
- `console.error`: hard failures, thrown exceptions, invariant violations.
- Never use logs as a substitute for proper error handling or returned error objects.

### Security and privacy rules (mandatory)

- Never log secrets or sensitive values:
  - Passwords
  - API keys / bearer tokens
  - Raw cookie values
  - Session tokens / JWT payloads
  - Webhook signing secrets
- Redact user identifiers where possible:
  - Prefer masked email (e.g., `ma***@domain.com`).
- For cookies, log only metadata:
  - Presence, count, and cookie names (not values).
- Keep payload logging minimal and safe:
  - Prefer top-level keys and booleans (`hasUser`, `hasSession`) over full body dumps.

### Frontend logging rules

- Frontend debug logs must be gated by a debug flag.
- Prefer enabling via `NEXT_PUBLIC_AUTH_DEBUG=1` and optional localStorage toggles.
- Default local log threshold must be `warn` (disable `console.log` and `console.info` diagnostics by default).
- In normal UX paths, keep runtime output to warnings/errors only.

### Server-side logging rules

- Server diagnostics may be heavier during incident debugging, but must remain structured, redacted, and explicitly gated.
- Include method, pathname, status, traceId, and key branch results.
- For auth routes, include set-cookie metadata (count/presence) but not cookie values.
- Default server log threshold must be `warn` unless an incident/debug override is explicitly enabled.

### Lifecycle and cleanup

- Temporary heavy logging is allowed during active debugging.
- Before merge to stable branches, remove non-warning/non-error diagnostics.
- Keep only high-value warning/error logs at critical boundaries for incident response.
