import type { Metadata } from "next"

// In production this data would come from the ANALYTICS_DB D1 binding.
// For now, static stubs are used to establish the route structure.

const MOCK_APIS = [
  { slug: "openai", name: "OpenAI", category: "LLM", description: "GPT-4o, o1, and the OpenAI API ecosystem.", trustScore: 9.2, latencyP50Ms: 180, uptimePercent: 99.95 },
  { slug: "openrouter", name: "OpenRouter", category: "Gateway", description: "300+ models via a single unified API with smart routing.", trustScore: 8.8, latencyP50Ms: 210, uptimePercent: 99.8 },
  { slug: "together-ai", name: "Together AI", category: "LLM", description: "Open-source model hosting with competitive pricing.", trustScore: 8.6, latencyP50Ms: 160, uptimePercent: 99.7 },
  { slug: "groq", name: "Groq", category: "LLM", description: "Ultra-fast inference on custom LPU hardware.", trustScore: 8.9, latencyP50Ms: 45, uptimePercent: 99.6 },
  { slug: "replicate", name: "Replicate", category: "Image + LLM", description: "Run any open-source model as a production API.", trustScore: 8.4, latencyP50Ms: 320, uptimePercent: 99.5 },
  { slug: "anthropic", name: "Anthropic", category: "LLM", description: "Claude 3.5 and Claude 3 family of frontier models.", trustScore: 9.0, latencyP50Ms: 195, uptimePercent: 99.9 },
]

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const api = MOCK_APIS.find((a) => a.slug === slug)
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

  if (!api) {
    return { title: "API not found | APIScore" }
  }

  return {
    title: `${api.name} API Review — Latency, Pricing & Alternatives`,
    description: `${api.description} See benchmarks, pricing, pros/cons, and recommended alternatives on APIScore.`,
    alternates: { canonical: `${siteUrl}/apis/${slug}` },
    openGraph: {
      type: "website",
      url: `${siteUrl}/apis/${slug}`,
      title: `${api.name} API Review | APIScore`,
      description: api.description ?? "",
      siteName: "APIScore",
      images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: `${api.name} API Review` }],
    },
    twitter: { card: "summary_large_image" },
  }
}

export async function generateStaticParams() {
  return MOCK_APIS.map((api) => ({ slug: api.slug }))
}

export default async function ApiProfilePage({ params }: Props) {
  const { slug } = await params
  const api = MOCK_APIS.find((a) => a.slug === slug)

  if (!api) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">API not found</h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          This API profile doesn't exist yet.{" "}
          <a href="/apis" className="text-[var(--hero-a)] hover:underline">Browse all APIs →</a>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <a href="/apis" className="text-sm text-[var(--text-muted)] hover:underline">← All APIs</a>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{api.name}</h1>
          <p className="mt-2 text-[var(--text-secondary)]">{api.description}</p>
          <span className="mt-3 inline-block rounded-full border border-[var(--line-soft)] px-3 py-0.5 text-xs text-[var(--text-muted)]">
            {api.category}
          </span>
        </div>
        <span className="rounded-xl bg-green-50 px-4 py-2 text-xl font-bold text-green-700">
          {api.trustScore}/10
        </span>
      </div>

      {/* Metrics */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "P50 latency", value: `${api.latencyP50Ms}ms` },
          { label: "Uptime", value: `${api.uptimePercent}%` },
          { label: "Trust score", value: `${api.trustScore}/10` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{m.label}</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Compare CTA */}
      <div className="mt-10 rounded-xl border border-[var(--line-soft)] bg-[var(--bg-section)] p-6">
        <h2 className="font-semibold">Compare {api.name} with another API</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Side-by-side comparison with consistent metrics and a verdict.
        </p>
        <a
          href="/compare"
          className="mt-4 inline-block rounded-lg bg-[var(--cta-a)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Go to comparisons →
        </a>
      </div>
    </main>
  )
}
