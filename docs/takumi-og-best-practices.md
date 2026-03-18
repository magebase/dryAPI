# Takumi OG Best Practices (OpenNext + Cloudflare Workers)

This project uses Takumi (`@takumi-rs/image-response` + `@takumi-rs/wasm`) for programmatic Open Graph image generation in OpenNext on Cloudflare Workers.

## Goals

- Use one OG generation path for public and app surfaces.
- Keep OG rendering on-demand at the edge (no large prebuild image jobs).
- Preserve readability across grainy gradient backgrounds with contrast-aware text colors.
- Cache aggressively to stay within Worker CPU and memory limits.

## Template Strategy

`src/lib/og/templates.tsx` defines four required template families:

- `marketing`
- `pricing`
- `dashboard`
- `blog`

Each template includes:

- Layered grainy gradient backgrounds (`repeating-linear-gradient` + radial glows).
- Shared typography and structure that maps to page intent.
- Seeded palette selection so images vary without breaking brand consistency.

All metadata producers should call `buildTakumiMetadata(...)` from `src/lib/og/metadata.ts`.

## Contrast and Readability

Use `pickAccessibleTextPalette(...)` for text/background pairing.

Implementation details:

- Compute luminance from gradient stop hex values.
- Compare dark and light text contrast ratios.
- Select the palette with better minimum contrast across all gradient stops.

This keeps title, description, and chips readable even when the gradient seed changes.

## Worker On-Demand Generation

OG images are generated at request time via `src/app/api/og/route.tsx`.

How it works:

1. Social crawler requests `/api/og?...`.
2. Worker checks edge cache (`caches.default`).
3. If miss, Worker checks persistent cache in R2 (`NEXT_INC_CACHE_R2_BUCKET`).
4. If miss, Takumi renders PNG and stores result in edge cache + R2.
5. Response includes long-lived cache headers.

Current cache profile:

- `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`

This architecture is aligned with Cloudflare Worker serverless on-demand generation:

- Scales with traffic.
- Avoids pre-generating very large image sets.
- Supports instant updates when content changes.

## Performance and Optimization

Based on Takumi optimization guidance:

- Initialize WASM once and reuse renderer instance (`initSync` + `new Renderer()`).
- Keep template trees simple and deterministic.
- Prefer edge + R2 cache hits over repeated renders.
- Clamp query input lengths to keep render payload bounded.

Worker operational constraints still apply (CPU/memory/time), so cache hit rate is a primary KPI.

## CI/CD Enforcement

Use `pnpm og:verify` to enforce OG coverage and template integrity.

Checks include:

- Metadata-producing routes must use Takumi helpers (`buildTakumiMetadata` or `generateDocsMetadata`).
- OG route must include Takumi runtime + Worker cache integration.
- Template system must include all four template families and contrast/grain logic.

CI integration:

- `prebuild` runs `tsx scripts/verify-takumi-og.ts`.
- `.github/workflows/cloudflare-deploy.yml` runs `pnpm og:verify` before deploy.

## Implementation Checklist

- Add page metadata with `buildTakumiMetadata`.
- Set the appropriate template (`marketing`, `pricing`, `dashboard`, `blog`).
- Provide canonical path and meaningful seed.
- Keep OG text concise (already clamped in metadata helper).
- Verify with `pnpm og:verify` before shipping.
