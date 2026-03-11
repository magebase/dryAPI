# AGENTS.md

Project: GenFix marketing and CMS site
Stack: Next.js App Router, TypeScript, TinaCMS, Tailwind CSS, Vitest
Reference: <https://tina.io/docs/vibe-coding>

## Core Goals

- Keep content editable in TinaCMS with safe schema-first updates.
- Preserve stable routing and avoid regressions in `/admin/index.html` and CMS behavior.
- Prefer small, testable changes over large rewrites.

## Repo Map

- Tina schema/config: `tina/config.js`
- Tina generated types/docs: `tina/__generated__/`
- Content source: `content/**/*.json`
- App routes: `src/app/**`
- Site components: `src/components/site/**`
- Content loading and mapping: `src/lib/site-content-loader.ts`
- Content schemas/validation: `src/lib/*schema*.ts`
- Footer/header/page rendering patterns: `src/components/site/*`

## Commands

- Dev (Tina + Next): `pnpm dev`
- Dev (Next only): `pnpm dev:next`
- Tina build: `pnpm tina:build`
- Production build: `pnpm build:tina`
- Lint: `pnpm lint`
- Tests: `pnpm test`

Important: `tinacms dev` does not support `--local` in this repo's current CLI version. Use script defaults from `package.json`.

## Vibe-Coding Workflow

- Set scope first: define goal, affected pages, and constraints before coding.
- Work in bite-sized tasks: one schema/component behavior at a time.
- Validate after each task: run app and verify target pages.
- Commit before risky or broad changes.
- Reset chat context between unrelated tasks.

## Tina-Specific Rules

- Schema first: add/change fields in `tina/config.js` before UI wiring.
- Keep schema and content in sync: update `content/**/*.json` when fields change.
- Use generated query types from `tina/__generated__/types` where applicable.
- For editable UI, use Tina field bindings (`data-tina-field`) when building Tina-driven components.

## Prompting Guidance For Agents

- Mention exact files when asking for edits.
- Include concrete acceptance criteria.
- Provide errors verbatim when debugging.
- Ask for diffs and verification steps, not just explanations.

## Guardrails

- Do not introduce broad formatting-only changes.
- Do not alter generated folders manually unless required.
- Do not kill unrelated services/processes; target only Tina/Next dev processes when needed.
- Keep React list keys stable and unique (never key lists by repeated `href` alone).

---

description: GenFix project context, business goals, and coding standards for Next.js, TinaCMS, and Cloudflare work.
applyTo: "\*\*"

---

# GenFix Copilot Instructions

Use these instructions when generating code, reviewing changes, debugging, or proposing architecture in this repository.

## Project context and business case

- GenFix is a marketing and CMS-driven website for generator sales, rentals, servicing, and lead capture.
- Core business outcome: convert traffic into qualified enquiries while allowing non-developers to edit content safely.
- Operational requirement: keep public pages stable and fast, keep Tina admin workflows reliable, and keep booking/contact/chat channels available.
- Security requirement: protect admin and automation paths while preserving customer-facing conversion paths.

## Technical context

- Stack: Next.js App Router, TypeScript, TinaCMS, Tailwind, Vitest, Cloudflare (OpenNext + Workers + D1 + R2 + Containers + Workflows).
- Content source of truth: `content/**/*.json`.
- Tina schema source of truth: `tina/config.js`.
- Key app areas:
  - Routes: `src/app/**`
  - Site components: `src/components/site/**`
  - Content loading/validation: `src/lib/site-content-loader.ts`, `src/lib/*schema*.ts`
  - Tina backend: `src/pages/api/tina/[...routes].ts`
  - Cloudflare container: `cloudflare/container/**`
  - Cloudflare workflows: `cloudflare/workflows/**`

## General working rules

- Favor small, testable, low-regression changes over broad rewrites.
- Preserve existing architecture patterns unless there is a clear bug or approved refactor.
- Avoid formatting-only churn and do not manually edit generated artifacts unless required.
- Keep changes scoped to the user request; do not opportunistically refactor unrelated code.
- If a change impacts schema, content, and rendering, update all three in one cohesive patch.

## Next.js best practices

- Default to Server Components. Add `"use client"` only when browser APIs, stateful interactivity, or client-only libraries are required.
- Keep route behavior stable in `src/app/[...slug]/page.tsx` and avoid breaking dynamic content-based routing.
- Use typed data boundaries and runtime validation where external input is involved.
- Keep hydration safe:
  - Avoid unstable ID generation between SSR and CSR.
  - Use deterministic keys for lists (never repeated `href` values alone).
- Respect hybrid preview/edit flows and locale behavior; do not break non-preview SSG behavior.
- Keep metadata/SEO and structured content intact when editing page templates.

## TinaCMS best practices

- Follow schema-first updates:
  - Add or modify fields in `tina/config.js` first.
  - Then wire UI/rendering and update `content/**/*.json` accordingly.
- Keep `tina/config.ts` aligned with `tina/config.js` to avoid generated type drift.
- Do not hand-edit `tina/__generated__/` unless the task explicitly requires it.
- Use Tina bindings (`data-tina-field`) in Tina-driven components so visual editing remains accurate.
- Preserve preview and editor flows (`/admin/index.html`, Tina API routes, preview query wiring).
- When adding editable static copy, prefer established site-level UI text patterns over hardcoded strings.

## Cloudflare best practices

- Use repository scripts for build/deploy operations:
  - `pnpm cf:build`
  - `pnpm cf:deploy`
  - `pnpm cf:calcom:deploy`
  - `pnpm cf:workflows:deploy`
- Keep secrets in Wrangler/GitHub secrets. Never hardcode secrets in code or docs.
- Preserve D1 migration workflows (`db:migrate:local`, `db:migrate:remote`) and binding contracts.
- Preserve route and security controls that protect admin/private paths without blocking public booking/contact endpoints.
- Keep container and workflow responsibilities separated:
  - Container package hosts Cal.com and operational endpoints.
  - Workflows package handles automation orchestration endpoints.

## Coding standards

- TypeScript-first: prefer explicit, safe types and narrow unknown input.
- Validate untrusted data at boundaries (request payloads, env vars, webhook input).
- Keep functions focused and composable; avoid large mixed-responsibility components.
- Use clear naming that matches business intent (sales, rentals, servicing, parts, general).
- Add brief comments only where logic is non-obvious.
- Preserve existing accessibility patterns for forms, dialogs, and interactive UI.

## Testing and verification standards

- Minimum checks for meaningful code changes:
  - `pnpm lint`
  - `pnpm test`
- For Tina/schema/content changes, also validate relevant pages in dev mode (`pnpm dev`).
- For deploy-sensitive Cloudflare changes, verify the relevant target path(s) and headers after deploy.
- In reviews, prioritize behavioral regressions, routing breakage, auth/security regressions, and missing tests.

## Change safety checklist

- Does the change preserve CMS editability and preview behavior?
- Does it preserve lead capture paths (contact, quote, chat escalation, booking)?
- Does it avoid hydration mismatches and unstable React keys?
- Does it keep environment variable and secret handling secure?
- Does it include or update tests for changed behavior?

## Communication style for AI outputs

- Be concrete and file-specific when suggesting edits.
- Explain risk and verification steps for non-trivial changes.
- When reviewing, list findings first by severity with file references.
- If uncertain, state assumptions clearly instead of inventing behavior.
