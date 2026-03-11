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
