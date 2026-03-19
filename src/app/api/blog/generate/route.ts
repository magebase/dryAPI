import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { parseMDX } from "@tinacms/mdx";
import { z } from "zod";

import { isAutomaticBlogEnabled } from "@/lib/feature-flags";
import { blogPostSchema, type BlogPost } from "@/lib/site-content-schema";
import { recordStripeMeterUsage } from "@/lib/stripe-metering";

type GeneratedPostDraft = {
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  tags: string[];
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const blogRoot = path.join(process.cwd(), "content", "blog");
const defaultModel = "gemini-3-flash-preview";
const defaultProvider = "gemini";
const fallbackCoverImage =
  "https://images.unsplash.com/photo-1567789884554-0b844b597180";
const richTextBodyField = { type: "rich-text", name: "body" } as const;

const keywordThemes = [
  "generator hire brisbane",
  "diesel generator service brisbane",
  "generator sales brisbane",
  "temporary power hire brisbane",
  "commercial generator maintenance brisbane",
  "generator emergency backup brisbane",
  "generator installation service brisbane",
  "generator rental for events brisbane",
  "industrial generator support brisbane",
  "generator fleet planning brisbane",
  "standby generator solutions brisbane",
  "generator load testing brisbane",
  "portable generator hire brisbane",
  "generator repairs brisbane",
  "generator replacement planning brisbane",
  "generator compliance checks brisbane",
  "mine site generator service brisbane",
  "construction generator hire brisbane",
  "hospital backup generator brisbane",
  "generator fuel management brisbane",
];

const requestSchema = z.object({
  provider: z.string().default(defaultProvider),
  model: z.string().default(defaultModel),
  count: z.coerce.number().int().min(1).max(50).default(1),
  focusKeywords: z.array(z.string().min(2)).max(20).optional(),
  dryRun: z.coerce.boolean().optional().default(false),
});

function getAuthToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function ensureAuthorized(request: NextRequest): NextResponse | null {
  const configuredSecret = process.env.BLOG_GENERATOR_SECRET?.trim();

  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          ok: false,
          error: "BLOG_GENERATOR_SECRET must be configured in production.",
        },
        { status: 500 },
      );
    }

    return null;
  }

  const incomingToken = getAuthToken(request);
  if (!incomingToken || incomingToken !== configuredSecret) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDateString(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function ensureMarkdownQuality(value: string): string {
  let markdown = value.trim();

  if (!/^\s*-\s+/m.test(markdown)) {
    markdown = [
      markdown,
      "",
      "- Confirm real startup and steady-state loads before final generator selection.",
      "- Match inspection intervals to runtime duty and site operating risk.",
      "- Capture handover notes so support teams can troubleshoot faster.",
    ].join("\n");
  }

  if (!/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(markdown)) {
    markdown = [
      markdown,
      "",
      "Reference: [Queensland business continuity planning](https://www.business.qld.gov.au/running-business/protect-business/risk-management/business-continuity-planning).",
    ].join("\n");
  }

  if (countWords(markdown) < 110) {
    markdown = [
      markdown,
      "",
      "A consistent markdown structure makes these recommendations easier for site teams to apply during planning, mobilisation, and ongoing service reviews.",
    ].join("\n");
  }

  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

function getUniqueTitle(
  title: string,
  usedTitles: Set<string>,
  fallback: string,
): string {
  const baseTitle = normalizeText(title, fallback);
  const baseKey = baseTitle.toLowerCase();

  if (!usedTitles.has(baseKey)) {
    usedTitles.add(baseKey);
    return baseTitle;
  }

  let suffix = 2;
  while (usedTitles.has(`${baseKey} (${suffix})`)) {
    suffix += 1;
  }

  const uniqueTitle = `${baseTitle} (${suffix})`;
  usedTitles.add(uniqueTitle.toLowerCase());
  return uniqueTitle;
}

function normalizeMarkdown(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .replace(/\r\n?/g, "\n")
    .replace(/^```(?:md|markdown)?\s*/i, "")
    .replace(/\s*```$/, "");

  const withoutTopHeading = normalized
    .split("\n")
    .filter((line) => !/^\s*#\s+/.test(line.trim()))
    .join("\n");

  const cleaned = withoutTopHeading
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return ensureMarkdownQuality(cleaned);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["Generator Hire", "Generator Service", "Brisbane"];
  }

  const tags = value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);

  const deduped = Array.from(new Set(tags));
  return deduped.length > 0
    ? deduped
    : ["Generator Hire", "Generator Service", "Brisbane"];
}

function normalizeSeoKeywords(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const keywords = value
    .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
    .filter(Boolean);

  const deduped = Array.from(new Set(keywords));
  return deduped.length > 0 ? deduped : fallback;
}

function normalizeSections(
  value: unknown,
): Array<{ heading: string; body: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const heading = normalizeText(
        (section as { heading?: unknown }).heading,
        "Generator Support In Brisbane",
      );
      const body = normalizeMarkdown(
        (section as { body?: unknown }).body,
        "Reliable generator outcomes in Brisbane depend on clear planning, fast support, and regular service checks.\n\n- Confirm actual site load profile before selecting equipment.\n- Align service intervals to runtime risk and duty cycle.\n- Capture handover notes so support teams can respond quickly.\n\nThis practical structure helps Brisbane teams reduce avoidable downtime and keep operations predictable.",
      );

      return { heading, body };
    })
    .filter(
      (section): section is { heading: string; body: string } =>
        section !== null,
    );
}

async function readExistingSlugs(): Promise<Set<string>> {
  const fileNames = await fs.readdir(blogRoot);
  return new Set(
    fileNames
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, "")),
  );
}

function getUniqueSlug(baseTitle: string, usedSlugs: Set<string>): string {
  const fallback = `brisbane-generator-blog-${randomUUID().slice(0, 8)}`;
  const base = slugify(baseTitle) || fallback;

  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }

  let suffix = 2;
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  const unique = `${base}-${suffix}`;
  usedSlugs.add(unique);
  return unique;
}

function buildPrompt(theme: string, publishedAt: string): string {
  return [
    "Write one SEO blog post for GenFix, an Australian generator company.",
    "Target audience: Brisbane businesses needing generator hire, service, maintenance, emergency support, or generator sales.",
    `Primary keyword theme: ${theme}.`,
    "Tone: practical, trustworthy, direct, no hype, no exaggerated claims.",
    "Use Australian English spelling.",
    `The article date context is ${publishedAt}.`,
    "Return ONLY valid JSON. Do not wrap in code fences. Do not add commentary.",
    "JSON shape:",
    "{",
    '  "title": "string",',
    '  "excerpt": "string",',
    '  "seoTitle": "string",',
    '  "seoDescription": "string",',
    '  "seoKeywords": ["string", "string", "string"],',
    '  "tags": ["string", "string", "string"],',
    '  "sections": [',
    '    { "heading": "string", "body": "string" },',
    '    { "heading": "string", "body": "string" },',
    '    { "heading": "string", "body": "string" },',
    '    { "heading": "string", "body": "string" }',
    "  ]",
    "}",
    "Rules:",
    "- Title: 55-75 characters and mention Brisbane or South East Queensland.",
    "- Excerpt: 140-190 characters.",
    "- seoTitle: under 65 characters.",
    "- seoDescription: under 160 characters.",
    "- Each section body MUST be clean GitHub-Flavoured Markdown (GFM) as a JSON string.",
    "- Each section body should be 130-220 words and follow this structure:",
    "  1) A short lead paragraph (2-3 sentences)",
    "  2) One markdown list with 3-5 actionable bullet points using '- '",
    "  3) A closing paragraph (1-2 sentences)",
    "- Optional: include one simple markdown table in ONE section only when it improves clarity.",
    "- Add at least one inline markdown link per section to a relevant high-authority source (government, standards, or manufacturer docs).",
    "- Never include raw HTML or JSX in section bodies.",
    "- Never include markdown code fences.",
    "- Do not start section bodies with '#' headings; headings are provided separately.",
    "- Include intent around hire, service, and sales where relevant.",
    "- Keep content generic and evergreen.",
  ].join("\n");
}

function buildFallbackDraft(theme: string, index: number): GeneratedPostDraft {
  const normalizedTheme = theme.trim() || "generator hire brisbane";
  const title = `Brisbane ${normalizedTheme.replace(/\bbrisbane\b/i, "").trim()} Guide ${index + 1}`;

  return {
    title,
    excerpt:
      "Use this practical Brisbane guide to compare generator hire, service, and sales pathways with clear planning steps for safer and more reliable site power.",
    seoTitle: `Brisbane Generator Hire Service Sales Guide ${index + 1}`,
    seoDescription:
      "Generic SEO guide for Brisbane businesses covering generator hire, service planning, and generator sales decision points.",
    seoKeywords: [
      "generator hire brisbane",
      "generator service brisbane",
      "temporary power planning",
    ],
    tags: [
      "Brisbane",
      "Generator Hire",
      "Generator Service",
      "Generator Sales",
    ],
    sections: [
      {
        heading: "Start With Site Load And Runtime Planning",
        body: [
          "Reliable temporary power outcomes begin with realistic load and runtime assumptions. Brisbane project teams should identify startup surges, critical equipment, and expected operating windows before finalising a generator plan.",
          "",
          "- Record peak and average load demand separately before requesting hire quotes.",
          "- Map runtime expectations by shift pattern, not just by total daily hours.",
          "- Confirm fuel logistics and refill access early for constrained sites.",
          "- Align mobilisation and commissioning windows with site readiness milestones.",
          "",
          "A simple planning baseline improves hire accuracy, reduces avoidable changeovers, and gives service teams clearer inspection timing throughout the project lifecycle.",
        ].join("\n"),
      },
      {
        heading: "Match Service Coverage To Project Risk",
        body: [
          "Service terms should match operational risk instead of following a fixed, one-size-fits-all interval. Sites with weather exposure, access constraints, or high consequence downtime need clearer inspection and escalation pathways.",
          "",
          "- Define who responds first, second, and third for after-hours faults.",
          "- Set inspection frequency based on duty cycle and environmental conditions.",
          "- Capture pre-start checks in a repeatable checklist used across crews.",
          "- Track alarms and trend changes so service teams can intervene earlier.",
          "",
          "Practical, risk-based maintenance standards make response decisions faster and help preserve uptime for both hired and owned generator assets.",
        ].join("\n"),
      },
      {
        heading: "Compare Sales Options Beyond Purchase Price",
        body: [
          "Generator sales decisions are stronger when teams assess lifecycle fit, not just upfront cost. Procurement teams should compare runtime profile, maintainability, commissioning quality, and support availability before selecting equipment.",
          "",
          "| Decision Area | Why It Matters |",
          "| --- | --- |",
          "| Service access | Reduces maintenance labour time and safety exposure |",
          "| Parts support | Minimises downtime during unplanned repairs |",
          "| Commissioning standards | Confirms performance before handover |",
          "",
          "Use purchase acceptance criteria that include load testing, documentation quality, and operator handover requirements so ownership outcomes remain stable over time.",
        ].join("\n"),
      },
      {
        heading: "Use One Handover Standard Across Hire And Ownership",
        body: [
          "A consistent handover process improves continuity between short-term hire and long-term ownership. Teams can move between providers and project phases with less friction when documentation standards stay the same.",
          "",
          "- Record baseline settings, alarm status, and key inspection observations at handover.",
          "- Include site-specific support contacts and escalation windows in every pack.",
          "- Store commissioning evidence where operations and maintenance teams can both access it.",
          "- Reuse the same checklist format for temporary and permanent generator assets.",
          "",
          "Standardised handover records build traceability, reduce onboarding delays, and improve planning confidence for future hire, service, and sales decisions.",
        ].join("\n"),
      },
    ],
  };
}

async function callGeminiModel({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<GeneratedPostDraft> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiResponse;

  await recordStripeMeterUsage({
    eventType: "ai_model_call",
    metadata: {
      provider: "gemini",
      surface: "blog-generator",
      model,
      status: response.status,
    },
  });

  if (!response.ok) {
    const message =
      payload.error?.message ||
      `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  const rawText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
  const modelText = stripCodeFence(rawText);

  if (!modelText) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini JSON payload was not an object.");
  }

  const draft = parsed as {
    title?: unknown;
    excerpt?: unknown;
    seoTitle?: unknown;
    seoDescription?: unknown;
    seoKeywords?: unknown;
    tags?: unknown;
    sections?: unknown;
  };

  const tags = normalizeTags(draft.tags);

  return {
    title: normalizeText(
      draft.title,
      "Generator Hire And Service Guide For Brisbane Sites",
    ),
    excerpt: normalizeText(
      draft.excerpt,
      "Learn how Brisbane teams can plan generator hire, maintenance, and replacement decisions with clear service steps and practical risk controls.",
    ),
    seoTitle: normalizeText(
      draft.seoTitle,
      "Brisbane Generator Hire And Service Guide",
    ),
    seoDescription: normalizeText(
      draft.seoDescription,
      "Practical guide to generator hire, service, and sales planning in Brisbane for commercial and industrial projects.",
    ),
    seoKeywords: normalizeSeoKeywords(draft.seoKeywords, tags),
    tags,
    sections: normalizeSections(draft.sections),
  };
}

function isQuotaOrRateLimitError(message: string): boolean {
  return /quota exceeded|rate limit|retry in\s+[0-9.]+s/i.test(message);
}

function getRetryDelayMs(message: string, attempt: number): number {
  const retryMatch = message.match(/retry in\s+([0-9.]+)s/i);
  if (retryMatch) {
    const seconds = Number(retryMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000) + 500;
    }
  }

  return Math.min(60_000, 4_000 * attempt);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callGeminiModelWithRetry(args: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<GeneratedPostDraft> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await callGeminiModel(args);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown generation error.";

      if (attempt >= maxAttempts || !isQuotaOrRateLimitError(message)) {
        throw error;
      }

      await wait(getRetryDelayMs(message, attempt));
    }
  }

  throw new Error("Gemini generation failed after retries.");
}

function materializePost({
  draft,
  slug,
  publishedAt,
}: {
  draft: GeneratedPostDraft;
  slug: string;
  publishedAt: string;
}): BlogPost {
  const sections =
    draft.sections.length > 0
      ? draft.sections
      : [
          {
            heading: "Plan Generator Hire Around Real Site Loads",
            body: "Brisbane projects get better temporary power outcomes when hiring decisions start with real load data instead of broad estimates. Identify startup loads, cycling equipment, and likely peak windows before selecting unit size. This avoids underperformance, fuel waste, and rushed changeovers. Align hire terms with mobilisation and handover milestones so equipment arrives when teams can commission safely and efficiently.",
          },
          {
            heading: "Use Scheduled Service To Protect Uptime",
            body: "Service reliability is often the difference between smooth operations and expensive disruption. Build a practical service plan that includes inspections, fuel checks, and alarm reviews at predictable intervals. Capture readings consistently so changes are spotted early. For Brisbane sites with variable weather and dust exposure, simple preventive checks reduce avoidable failures and support safer operations during critical periods.",
          },
          {
            heading: "Compare Generator Sales Options With Lifecycle Costs",
            body: "When moving from hire to ownership, compare more than purchase price. Include expected runtime, maintenance needs, operator capability, and spare-part lead times in the decision. A right-sized unit with clear service access can outperform a cheaper alternative over its lifecycle. Procurement teams should also define commissioning standards and support arrangements early, so long-term reliability is built into the initial sales decision.",
          },
        ];

  const richTextMarkdown = sections
    .map(
      (section) =>
        `## ${section.heading}\n\n${normalizeMarkdown(section.body, section.body)}`,
    )
    .join("\n\n");

  const richTextBody = parseMDX(
    richTextMarkdown,
    richTextBodyField,
    (value) => value,
  );

  const post: BlogPost = {
    slug,
    title: draft.title,
    excerpt: draft.excerpt,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoKeywords: draft.seoKeywords,
    canonicalPath: `/blog/${slug}`,
    ogImage: fallbackCoverImage,
    noindex: false,
    publishedAt,
    author: {
      name: "GenFix Editorial Team",
      role: "Generator Solutions Specialists",
      bio: "GenFix specialists in temporary power, generator servicing, and backup system planning for Australian sites.",
    },
    coverImage: fallbackCoverImage,
    tags: draft.tags,
    body: richTextBody,
  };

  return blogPostSchema.parse(post);
}

async function writeBlogPost(post: BlogPost): Promise<string> {
  const filePath = path.join(blogRoot, `${post.slug}.json`);
  const payload = `${JSON.stringify(post, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf8");
  return filePath;
}

export async function POST(request: NextRequest) {
  if (!isAutomaticBlogEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Automatic blog generation is disabled.",
      },
      { status: 404 },
    );
  }

  const authFailure = ensureAuthorized(request);
  if (authFailure) {
    return authFailure;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing GEMINI_API_KEY (or GOOGLE_API_KEY fallback).",
      },
      { status: 500 },
    );
  }

  let parsedRequest: z.infer<typeof requestSchema>;
  try {
    const body = await request.json().catch(() => ({}));
    parsedRequest = requestSchema.parse(body);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  if (parsedRequest.provider.toLowerCase() !== defaultProvider) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported provider '${parsedRequest.provider}'. Use '${defaultProvider}'.`,
      },
      { status: 400 },
    );
  }

  const usedSlugs = await readExistingSlugs();
  const userThemes =
    parsedRequest.focusKeywords?.filter((value) => value.trim().length > 0) ??
    [];
  const themes = userThemes.length > 0 ? userThemes : keywordThemes;

  const created: Array<{
    slug: string;
    title: string;
    filePath: string;
    publishedAt: string;
  }> = [];
  const errors: Array<{ index: number; error: string }> = [];
  let fallbackCount = 0;
  const usedTitles = new Set<string>();

  for (let index = 0; index < parsedRequest.count; index += 1) {
    const theme = themes[index % themes.length];
    const publishedAt = toDateString(
      new Date(Date.now() - index * 24 * 60 * 60 * 1000),
    );

    try {
      const prompt = buildPrompt(theme, publishedAt);
      const draft = await callGeminiModelWithRetry({
        apiKey,
        model: parsedRequest.model,
        prompt,
      });
      const title = getUniqueTitle(
        draft.title,
        usedTitles,
        `Brisbane Generator Planning Guide ${index + 1}`,
      );
      const normalizedDraft: GeneratedPostDraft = {
        ...draft,
        title,
      };
      const slug = getUniqueSlug(normalizedDraft.title, usedSlugs);
      const post = materializePost({
        draft: normalizedDraft,
        slug,
        publishedAt,
      });

      if (!parsedRequest.dryRun) {
        const filePath = await writeBlogPost(post);
        created.push({
          slug: post.slug,
          title: post.title,
          filePath,
          publishedAt: post.publishedAt,
        });
      } else {
        created.push({
          slug: post.slug,
          title: post.title,
          filePath: "(dry-run)",
          publishedAt: post.publishedAt,
        });
      }
    } catch (error) {
      errors.push({
        index,
        error:
          error instanceof Error ? error.message : "Unknown generation error.",
      });

      const fallbackDraft = buildFallbackDraft(theme, index);
      const fallbackTitle = getUniqueTitle(
        fallbackDraft.title,
        usedTitles,
        `Brisbane Generator Reliability Guide ${index + 1}`,
      );
      const fallbackNormalizedDraft: GeneratedPostDraft = {
        ...fallbackDraft,
        title: fallbackTitle,
      };
      const fallbackSlug = getUniqueSlug(
        fallbackNormalizedDraft.title,
        usedSlugs,
      );
      const fallbackPost = materializePost({
        draft: fallbackNormalizedDraft,
        slug: fallbackSlug,
        publishedAt,
      });

      if (!parsedRequest.dryRun) {
        const filePath = await writeBlogPost(fallbackPost);
        created.push({
          slug: fallbackPost.slug,
          title: fallbackPost.title,
          filePath,
          publishedAt: fallbackPost.publishedAt,
        });
      } else {
        created.push({
          slug: fallbackPost.slug,
          title: fallbackPost.title,
          filePath: "(dry-run)",
          publishedAt: fallbackPost.publishedAt,
        });
      }

      fallbackCount += 1;
    }
  }

  const status = errors.length > 0 && created.length === 0 ? 500 : 200;

  return NextResponse.json(
    {
      ok: errors.length === 0,
      provider: defaultProvider,
      model: parsedRequest.model,
      requested: parsedRequest.count,
      createdCount: created.length,
      fallbackCount,
      created,
      errors,
    },
    { status },
  );
}
