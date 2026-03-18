import type { Metadata } from "next"

// Slug format: "{api-a}-vs-{api-b}"
const COMPARISON_REGISTRY: Record<
  string,
  {
    a: { name: string; slug: string; trustScore: number; latencyMs: number; pros: string[]; cons: string[] }
    b: { name: string; slug: string; trustScore: number; latencyMs: number; pros: string[]; cons: string[] }
    verdict: { cheapest: string; fastest: string; mostFlexible: string; bestForStartups: string }
  }
> = {
  "openai-vs-anthropic": {
    a: {
      slug: "openai", name: "OpenAI", trustScore: 9.2, latencyMs: 180,
      pros: ["Broadest model selection", "Mature API surface", "Best ecosystem/tooling support"],
      cons: ["Higher cost at scale", "Rate limits can bite at growth stage"],
    },
    b: {
      slug: "anthropic", name: "Anthropic", trustScore: 9.0, latencyMs: 195,
      pros: ["Strong safety and reliability", "Long context windows", "Excellent instruction following"],
      cons: ["Fewer model variants", "Smaller third-party ecosystem"],
    },
    verdict: {
      cheapest: "Anthropic (Claude Haiku)",
      fastest: "OpenAI (GPT-4o-mini)",
      mostFlexible: "OpenAI",
      bestForStartups: "OpenAI for ecosystem, Anthropic for quality/safety-first use cases",
    },
  },
  "together-ai-vs-groq": {
    a: {
      slug: "together-ai", name: "Together AI", trustScore: 8.6, latencyMs: 160,
      pros: ["Wide open-source model selection", "Competitive pricing", "Fine-tuning support"],
      cons: ["Cold start latency on some models", "Less predictable throughput under load"],
    },
    b: {
      slug: "groq", name: "Groq", trustScore: 8.9, latencyMs: 45,
      pros: ["Fastest inference available", "Consistent low latency", "Streaming optimized"],
      cons: ["Limited model selection", "No fine-tuning", "Context window limits"],
    },
    verdict: {
      cheapest: "Together AI",
      fastest: "Groq (by a significant margin)",
      mostFlexible: "Together AI",
      bestForStartups: "Groq for real-time UX, Together AI for cost-efficiency",
    },
  },
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const comp = COMPARISON_REGISTRY[slug]
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

  if (!comp) return { title: "Comparison not found | APIScore" }

  const title = `${comp.a.name} vs ${comp.b.name} — API Comparison`

  return {
    title,
    description: `Side-by-side comparison of ${comp.a.name} and ${comp.b.name}. See latency, pricing, pros/cons, and verdict by use case.`,
    alternates: { canonical: `${siteUrl}/compare/${slug}` },
    openGraph: {
      type: "website",
      url: `${siteUrl}/compare/${slug}`,
      title: `${title} | APIScore`,
      description: `${comp.a.name} vs ${comp.b.name}: which AI API wins?`,
      siteName: "APIScore",
      images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image" },
  }
}

export async function generateStaticParams() {
  return Object.keys(COMPARISON_REGISTRY).map((slug) => ({ slug }))
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params
  const comp = COMPARISON_REGISTRY[slug]

  if (!comp) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Comparison not found</h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          <a href="/compare" className="text-[var(--hero-a)] hover:underline">Browse all comparisons →</a>
        </p>
      </main>
    )
  }

  const { a, b, verdict } = comp

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <a href="/compare" className="text-sm text-[var(--text-muted)] hover:underline">← All comparisons</a>

      <h1 className="mt-6 text-3xl font-bold">
        {a.name} vs {b.name}
      </h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Side-by-side API comparison with consistent metrics and a verdict by use case.
      </p>

      {/* Metrics table */}
      <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--line-soft)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-section)]">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-[var(--text-muted)]">Metric</th>
              <th className="px-5 py-3 text-left font-semibold">{a.name}</th>
              <th className="px-5 py-3 text-left font-semibold">{b.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)] bg-[var(--surface-strong)]">
            <tr>
              <td className="px-5 py-3 text-[var(--text-muted)]">Trust score</td>
              <td className="px-5 py-3 font-medium">{a.trustScore}/10</td>
              <td className="px-5 py-3 font-medium">{b.trustScore}/10</td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-[var(--text-muted)]">P50 latency</td>
              <td className="px-5 py-3">{a.latencyMs}ms</td>
              <td className="px-5 py-3">{b.latencyMs}ms</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pros / cons */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {[a, b].map((api) => (
          <div key={api.slug} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-5">
            <h2 className="font-semibold">{api.name}</h2>
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-green-700">Pros</p>
              <ul className="mt-1 space-y-1">
                {api.pros.map((p) => <li key={p} className="text-sm text-[var(--text-secondary)]">✓ {p}</li>)}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-red-600">Cons</p>
              <ul className="mt-1 space-y-1">
                {api.cons.map((c) => <li key={c} className="text-sm text-[var(--text-secondary)]">✗ {c}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div className="mt-10 rounded-xl border border-[var(--line-soft)] bg-[var(--bg-section)] p-6">
        <h2 className="font-semibold">Verdict by use case</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(verdict).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-[var(--surface-strong)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </p>
              <p className="mt-1 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
