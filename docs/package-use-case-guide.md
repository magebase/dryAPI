# Package Use Case Guide

This repository already includes a broad dependency set. Prefer the packages below before writing bespoke helpers, especially for query parsing, date math, forms, validation, and UI state.

## First Choices

- `nuqs`: use for URL query-string state in App Router pages and client components; do not hand-roll search-param parsing for page state.
- `lodash`: use for non-trivial array/object transforms, deep reads, defaults, dedupe, sorting, and stable utility helpers; prefer path imports.
- `date-fns`: use for parsing, formatting, and date arithmetic.
- `zod`: use for schemas, boundary validation, and request parsing.
- `@tanstack/react-form`: use for typed client forms with schema-backed validation.
- `@tanstack/react-query`: use for client mutations, cache invalidation, optimistic updates, and async UI state.
- `next-seo`: use for JSON-LD and structured data in App Router `page.tsx` files.
- `next-safe-action`: use for typed server-action wrappers when a mutation needs a client-callable contract.

## Runtime Packages

- `next`: App Router, server components, route handlers, metadata, and the main app runtime.
- `react`: component model and hooks.
- `react-dom`: DOM rendering and hydration.
- `server-only`: mark modules that must never be bundled client-side.
- `next-themes`: theme switching and theme persistence.
- `sonner`: toast notifications.
- `clsx`: conditional class composition.
- `tailwind-merge`: resolve conflicting Tailwind class strings.
- `class-variance-authority`: build typed UI variants from class tokens.
- `lucide-react`: general-purpose UI icons.
- `simple-icons`: brand/logo icons when the site needs official marks.
- `shadcn`: generate and scaffold shared UI primitives.
- `radix-ui`: accessible low-level primitives that underpin ShadCN components.
- `cmdk`: command palette and searchable menus.
- `input-otp`: one-time-passcode and verification inputs.
- `vaul`: drawers and sheet-style overlays.
- `react-day-picker`: calendar and date-picker experiences.
- `react-resizable-panels`: split panes and resizable dashboard layouts.
- `embla-carousel-react`: carousels and swipeable slides.
- `react-markdown`: render markdown content safely in React.
- `remark-gfm`: GitHub-flavored markdown support.
- `react-hook-form`: legacy form islands only; prefer TanStack Form for new work.
- `recharts`: charts and data visualizations.
- `millify`: compact formatting for large numbers.
- `ms`: parse or format time durations in milliseconds.
- `nanoid`: short, collision-resistant identifiers.
- `lenis`: smooth scrolling where the interaction is intentional.
- `aos`: lightweight scroll-triggered reveals.
- `gradient-gl`: gradient-heavy visual effects and decorative backgrounds.
- `cookieconsent`: cookie consent banner flows.
- `@microsoft/clarity`: session analytics and product behavior visibility.
- `citemet`: AI share/summarize links and outbound assistant handoff.
- `feed`: RSS and Atom feeds.
- `openapi-types`: type definitions for OpenAPI document shapes.
- `ra-data-simple-rest`: React Admin simple REST data provider.
- `react-admin`: admin back-office UI when the data model fits that framework.
- `resend`: transactional email sending.
- `stripe`: Stripe API calls on the server.
- `stripe-event-types`: typed Stripe webhook event shapes.
- `jose`: JWT signing, verification, and JOSE primitives.
- `next-safe-action`: typed server action wrappers for secure client-callable mutations.
- `nuqs`: URL state and search-param synchronization; keep query state out of local component state when the URL should be the source of truth.
- `lodash`: prefer it for nested transforms or defensive lookups instead of custom utility code.
- `date-fns`: date math, formatting, and parsing instead of manual millisecond arithmetic.
- `zod`: schema validation for request payloads, form data, and config parsing.
- `zod-form-data`: parse `FormData` into typed objects with Zod.
- `typebox`: JSON-schema-first typed contracts when an API needs schema generation.
- `@t3-oss/env-nextjs`: typed environment variable validation and server/client env access.
- `@aws-sdk/client-s3`: S3-compatible object reads/writes.
- `@aws-sdk/s3-request-presigner`: presigned S3 uploads and downloads.
- `@upstash/redis`: hosted Redis access.
- `upstash-redis-level`: Level-style access backed by Upstash Redis.
- `abstract-level`: abstract LevelDB interface for storage adapters.
- `drizzle-orm`: SQL query building and typed database access.
- `better-auth`: auth core, sessions, and auth flows.
- `better-auth-cloudflare`: Better Auth bindings for Cloudflare environments.
- `better-auth-harmony`: Better Auth harmony helpers used by the current auth stack.
- `@better-auth/api-key`: API key support in Better Auth.
- `@better-auth/i18n`: localized Better Auth UI and messaging.
- `@better-auth/oauth-provider`: OAuth provider integrations.
- `@better-auth/sso`: SSO-related auth flows.
- `@better-auth/stripe`: Stripe billing hooks inside Better Auth.
- `@opennextjs/cloudflare`: build and runtime adapter for Next.js on Cloudflare.
- `@serwist/next`: Next.js integration for service-worker registration.
- `serwist`: service worker and PWA runtime.
- `hono`: Cloudflare Worker API gateway and lightweight edge routing.
- `@hono/standard-validator`: request validation middleware for Hono.
- `hono-openapi`: OpenAPI generation for Hono routes.
- `@standard-community/standard-json`: standard JSON schema helpers for API contracts.
- `@standard-community/standard-openapi`: standard OpenAPI helpers for schema-driven docs.
- `@takumi-rs/image-response`: Open Graph and social image generation.
- `@takumi-rs/wasm`: Takumi WASM runtime support for image generation.
- `@tanstack/react-form`: typed forms and validation.
- `@tanstack/react-query`: async state, caching, and mutation orchestration.
- `@tanstack/react-virtual`: large-list virtualization.
- `@tanstack/zod-form-adapter`: Zod integration for TanStack Form.
- `@tinacms/cli`: TinaCMS build and authoring workflows.
- `@tinacms/datalayer`: Tina data storage layer.
- `@tinacms/graphql`: Tina GraphQL transport and schema tooling.
- `@tinacms/mdx`: Tina MDX tooling.
- `@tinacms/schema-tools`: Tina schema generation and validation utilities.
- `tinacms`: TinaCMS runtime and editor.
- `tinacms-gitprovider-github`: Tina GitHub-backed content workflows.
- `fumadocs-core`: docs system primitives.
- `fumadocs-mdx`: Fumadocs MDX integration.
- `fumadocs-openapi`: OpenAPI docs viewer and API reference pages.
- `fumadocs-ui`: docs UI components.
- `@react-email/components`: email-safe React Email building blocks.
- `@react-email/render`: render React Email to HTML/text.

## UI, Motion, And Layout Helpers

- `@base-ui/react`: low-level accessible primitives when a Base UI component is the right fit.
- `class-variance-authority`, `clsx`, `tailwind-merge`: compose variant-driven Tailwind classes without custom merge logic.
- `tw-animate-css`: animation utilities and tokens for Tailwind v4.
- `aos`: section-level reveal animations when the existing motion system is not enough.
- `lenis`: smooth-scroll interactions for marketing pages.
- `gradient-gl`: rich gradient overlays and glow treatments.
- `embla-carousel-react`: swipeable carousels.
- `react-resizable-panels`: adjustable split layouts.
- `vaul`: drawers and sheets.
- `cmdk`: command palette search and quick actions.
- `input-otp`: OTP capture and verification UI.
- `react-day-picker`: calendar/date chooser UI.
- `recharts`: charts and KPI visualizations.
- `lucide-react`: general-purpose icons for buttons, headers, metadata rows, and status states.
- `simple-icons`: branded third-party logos.

## Content, Docs, And SEO

- `next-seo`: structured data, canonical-friendly metadata helpers, and JSON-LD output.
- `react-markdown`: render markdown bodies from content or docs sources.
- `remark-gfm`: tables, task lists, and GFM formatting in markdown content.
- `feed`: RSS/Atom output generation.
- `next-sitemap`: sitemap generation during build.
- `@types/mdx`: MDX typing support.
- `@types/json-schema`: schema typing for JSON-schema work.

## Cloudflare, Workers, And Storage

- `wrangler`: D1, Worker, and Cloudflare local/remote development.
- `@cloudflare/vitest-pool-workers`: worker-aware Vitest execution.
- `hono`: edge API routing.
- `@hono/standard-validator`: schema validation for Worker endpoints.
- `hono-openapi`: OpenAPI generation from Hono routes.
- `@opennextjs/cloudflare`: OpenNext deployment on Cloudflare.
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`: S3-compatible storage and presigned URLs.
- `@upstash/redis`, `upstash-redis-level`, `abstract-level`: Redis and Level-style storage adapters.
- `drizzle-orm` and `drizzle-kit`: D1 schema, queries, and migrations.
- `@takumi-rs/image-response` and `@takumi-rs/wasm`: generated image assets for social/OG cards.
- `@serwist/next` and `serwist`: PWA/service-worker support.

## Testing And Automation

- `vitest`: unit and integration tests.
- `@vitest/coverage-istanbul`, `@vitest/coverage-v8`: coverage reporting.
- `playwright`: browser automation and E2E checks.
- `@playwright/test`: Playwright test runner helpers.
- `@browserbasehq/stagehand`: browser-based E2E flows that need AI-assisted interactions.
- `@testing-library/react`: component testing in jsdom.
- `@testing-library/user-event`: realistic user interaction simulation.
- `@testing-library/jest-dom`: DOM matchers for test assertions.
- `jsdom`: DOM-like test environment.
- `tsx`: run TypeScript scripts directly.
- `lefthook`: git hooks and repo automation.
- `eslint` and `eslint-config-next`: linting.

## Types And Build-Time Support

- `@types/node`: Node.js type support.
- `@types/react` and `@types/react-dom`: React type support.
- `@types/lodash`: Lodash type support.
- `@types/aos`: AOS type support.
- `@types/testing-library__jest-dom`: Jest DOM type support.
- `typescript`: compiler and language service.
- `@tailwindcss/postcss`: Tailwind CSS v4 PostCSS integration.

## Form And Validation Support

- `zod`: schema validation and canonical parsing.
- `zod-form-data`: typed `FormData` parsing.
- `@hookform/resolvers`: resolver bridge for legacy react-hook-form integrations.
- `react-hook-form`: only for existing legacy flows; prefer TanStack Form for new forms.
- `@tanstack/zod-form-adapter`: Zod integration for TanStack Form.

## Maintenance Rule

- When a new helper seems like a utility that can be covered by an existing package, check this guide before adding custom code.
- When introducing a new dependency, add it here with a short use case and update `AGENTS.md` if the choice changes repo-wide conventions.
