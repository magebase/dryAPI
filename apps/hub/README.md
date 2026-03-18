# APIScore Hub

AI API discovery hub — compare, benchmark, and choose the right AI API for any use case.

## Stack

- **Next.js 16** + App Router + TypeScript
- **Tailwind CSS v4** + ShadCN-compatible primitives
- **Better Auth** (email/password, Google, GitHub, API keys)
- **Cloudflare D1** (auth + analytics databases via Drizzle ORM)
- **OpenNext on Cloudflare Workers** (server-side rendering at the edge)

## Local development

```bash
pnpm install
pnpm db:migrate:local   # Apply D1 migrations locally via Wrangler
pnpm dev                # Start Next.js on http://localhost:3001
```

## Building for Cloudflare

```bash
pnpm cf:build           # Build via OpenNext + sitemap
pnpm cf:preview         # Preview with Wrangler locally
pnpm cf:deploy          # Build + deploy to Cloudflare Workers
```

## Database migrations

```bash
pnpm db:generate        # Regenerate Drizzle migration files
pnpm db:migrate:local   # Apply locally (Wrangler D1 local)
pnpm db:migrate:remote  # Apply to production D1 databases
```

## Tests

```bash
pnpm test               # Run Vitest unit tests
pnpm test:coverage      # With coverage report
```

## Environment variables

```
BETTER_AUTH_SECRET=        # Required: random 32+ char secret
BETTER_AUTH_URL=           # Required: public base URL (e.g. https://apiscore.dev)
NEXT_PUBLIC_SITE_URL=      # Public site URL for metadata/canonical/OG
CLOUDFLARE_API_TOKEN=      # For remote D1 migrations + Wrangler deploy
CLOUDFLARE_ACCOUNT_ID=     # Cloudflare account
CF_D1_DATABASE_ID_HUB_AUTH=      # Remote D1 auth DB id
CF_D1_DATABASE_ID_HUB_ANALYTICS= # Remote D1 analytics DB id
GOOGLE_CLIENT_ID=          # Optional: OAuth sign-in
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=          # Optional: OAuth sign-in
GITHUB_CLIENT_SECRET=
```

## Key routes

| Route | Description |
|-------|-------------|
| `/` | Homepage — featured APIs + use cases |
| `/apis` | Full API directory |
| `/apis/[slug]` | API profile: benchmarks, pricing, alternatives |
| `/compare/[slug]` | Side-by-side comparison (`provider-a-vs-provider-b`) |
| `/use-cases/[slug]` | Use-case pages with ranked API recommendations |
| `/dashboard` | Auth-gated usage dashboard (TODO) |
| `/api/auth/[...all]` | Better Auth handler |
