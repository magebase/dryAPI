# Production Bug Hunt - 2026-03-27

Verified against `https://dryapi.dev` in the browser. This report records the live-site defects observed during the pass.

## Findings

1. The Cloudflare RUM request fails on every visited page with `POST https://dryapi.dev/cdn-cgi/rum?` returning `ERR_ABORTED`.
2. The homepage header shows duplicate `Sign In` actions, which splits the primary auth CTA across two identical entry points.
3. The homepage hero uses `Get Started` as a link to `/login`, so the CTA does not actually start onboarding.
4. The homepage code samples hardcode `https://api.dryapi.dev/v1/inference` instead of the canonical site/app origin used elsewhere.
5. The homepage hero copy is inconsistent with the rest of the site: it says `Dozens Of Models` while other pages report `11 Total Models` and `10 Categories`.
6. The pricing page table uses broken grammar in multiple rows, such as `Explore 1 rows` and `Explore 62 rows`.
7. The pricing page first row renders a stray dash before `Default for 1 of 1`, which looks like an unhandled missing-value placeholder.
8. The pricing page `Background Removal` row exposes raw parameter text inline as `Ben2 width=2100, height=100`, which reads like debug data leaking into the UI.
9. The pricing page `Text To Image` row shows a malformed parameter blob with `height=1088`, which is a suspicious data error.
10. The pricing page `Image To Image` row duplicates the count label as `+1 +1 more`.
11. The pricing page footer social links point to generic network homepages for Facebook, Instagram, and YouTube instead of brand-owned profiles.
12. The pricing page LinkedIn footer link points to `linkedin.com/company/deapi`, which is the wrong brand target.
13. The pricing page card CTA `Check Models` routes to `/contact-sales` instead of the models catalog.
14. The plans page also triggers the failing Cloudflare RUM request on load.
15. The plans page uses public `Get started` links that point directly to `/api/dashboard/billing/subscribe?plan=...`, which is a brittle public entry point for a state-changing billing flow.
16. The models page exposes route slugs without readable separators, for example `zimageturbo-int8` and `whisperlargev3` in the detail URLs.
17. The models page category and model names are inconsistently cased, such as `Nanonets Ocr S F16` and `Text To Embedding`.
18. The models page shows awkward pluralization like `1 variants` in category counts.
19. The playground page logs a `401` console error on load.
20. The playground page also logs a CSS preload warning: the preloaded stylesheet is not used within a few seconds of load.
21. The playground page `Open in` links duplicate the provider name in the visible label, for example `ChatGPT ChatGPT`, `Claude Claude`, and `Perplexity Perplexity`.
22. The contact-sales page links `Request Consultation` to `/contact`, but the route does not exist in the repo.
23. The contact-sales page links `View Product Range` to `/products`, but the route does not exist in the repo.
24. The contact-sales page footer link `Remote-first team, global coverage` points to `/about`, but the route does not exist in the repo.
25. The contact-sales page links `Read Architecture` and `Review Security` to `/docs/architecture-and-security`, but that route does not exist in the repo.
26. The docs API reference sidebar includes `n8n dryAPI node`, which links to `/docs/v1/execution-modes-and-integrations/n8n-deapi-node`; that slug contains the wrong brand token and does not exist in the source tree.
27. The docs API reference sidebar links `Status` to `https://status.dryapi.ai/`, which is a brand-inconsistent external target.
28. The `/docs` landing route resolves to `/docs/v1` but the browser snapshot shows only an alert state instead of a usable docs landing experience.

## Notes

- The webhook settings validation issue was fixed separately in the form code so invalid webhook URLs now block validation and save attempts until the field is clean.
- Missing routes were checked against the repo with file searches before being recorded here.
