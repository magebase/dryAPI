import type { Metadata } from "next"

const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

export const metadata: Metadata = {
  title: "AI API Directory — Browse & Compare 100+ APIs",
  description:
    "Browse every major AI API including LLMs, image generation, speech, and embeddings. Ranked by trust score, latency, and pricing.",
  alternates: { canonical: `${siteUrl}/apis` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/apis`,
    title: "AI API Directory | APIScore",
    description: "Browse 100+ AI APIs ranked by speed, cost, and reliability.",
    siteName: "APIScore",
    images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: "AI API Directory" }],
  },
  twitter: { card: "summary_large_image" },
}

const CATEGORIES = ["All", "LLM", "Image", "Speech", "Embedding", "Gateway"]

const APIS = [
  { slug: "openai", name: "OpenAI", category: "LLM", trustScore: 9.2, latencyMs: 180, description: "GPT-4o, o1, and the full OpenAI API ecosystem." },
  { slug: "anthropic", name: "Anthropic", category: "LLM", trustScore: 9.0, latencyMs: 195, description: "Claude 3.5 and Claude 3 family of frontier models." },
  { slug: "groq", name: "Groq", category: "LLM", trustScore: 8.9, latencyMs: 45, description: "Ultra-fast inference on custom LPU hardware." },
  { slug: "openrouter", name: "OpenRouter", category: "Gateway", trustScore: 8.8, latencyMs: 210, description: "300+ models via a single unified API." },
  { slug: "together-ai", name: "Together AI", category: "LLM", trustScore: 8.6, latencyMs: 160, description: "Open-source model hosting at scale." },
  { slug: "replicate", name: "Replicate", category: "Image + LLM", trustScore: 8.4, latencyMs: 320, description: "Run any open-source model as a production API." },
]

export default function ApisPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold">AI API Directory</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        {APIS.length}+ providers ranked by trust score, latency, and pricing.
      </p>

      {/* Category filter (static for now — can be upgraded to nuqs search params) */}
      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-strong)] px-4 py-1.5 text-sm hover:border-[var(--hero-a)] transition-colors"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APIS.map((api) => (
          <a
            key={api.slug}
            href={`/apis/${api.slug}`}
            className="group rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold group-hover:text-[var(--hero-a)] transition-colors">{api.name}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{api.category}</p>
              </div>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                {api.trustScore}/10
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--text-secondary)] line-clamp-2">{api.description}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">P50 latency: {api.latencyMs}ms</p>
          </a>
        ))}
      </div>
    </main>
  )
}
