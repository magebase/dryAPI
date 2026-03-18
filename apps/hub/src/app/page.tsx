import type { Metadata } from "next"

const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

export const metadata: Metadata = {
  title: "AI API Discovery Hub — Compare, Benchmark & Choose",
  description:
    "The developer discovery layer for AI APIs. Compare 100+ LLM, image, speech, and embedding APIs by speed, cost, reliability, and use case.",
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "APIScore — AI API Discovery Hub",
    description:
      "Compare 100+ AI APIs by latency, pricing, and reliability. Find the best API for your use case in seconds.",
    siteName: "APIScore",
    images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: "APIScore" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "APIScore — AI API Discovery Hub",
    description: "Compare 100+ AI APIs by latency, pricing, and reliability.",
    images: [`${siteUrl}/og/default.png`],
  },
}

const FEATURED_APIS = [
  { slug: "openai", name: "OpenAI", category: "LLM", trustScore: 9.2, latencyMs: 180 },
  { slug: "openrouter", name: "OpenRouter", category: "Gateway", trustScore: 8.8, latencyMs: 210 },
  { slug: "together-ai", name: "Together AI", category: "LLM", trustScore: 8.6, latencyMs: 160 },
  { slug: "groq", name: "Groq", category: "LLM", trustScore: 8.9, latencyMs: 45 },
  { slug: "replicate", name: "Replicate", category: "Image + LLM", trustScore: 8.4, latencyMs: 320 },
  { slug: "anthropic", name: "Anthropic", category: "LLM", trustScore: 9.0, latencyMs: 195 },
]

const USE_CASES = [
  { slug: "best-ai-api-for-chatbots", title: "Best AI API for Chatbots", icon: "💬" },
  { slug: "best-llm-api-for-agents", title: "Best LLM API for AI Agents", icon: "🤖" },
  { slug: "cheapest-gpt-4o-alternative", title: "Cheapest GPT-4o Alternative", icon: "💰" },
  { slug: "fastest-text-generation-api", title: "Fastest Text Generation API", icon: "⚡" },
  { slug: "best-ai-api-for-startups", title: "Best AI API for Startups", icon: "🚀" },
  { slug: "best-embedding-api", title: "Best Embedding API", icon: "🔗" },
]

export default function HomePage() {
  return (
    <main>
      {/* Nav */}
      <header className="border-b border-[var(--line-soft)] bg-[var(--surface-strong)]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">APIScore</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
            <a href="/apis" className="hover:text-[var(--text-primary)] transition-colors">APIs</a>
            <a href="/compare" className="hover:text-[var(--text-primary)] transition-colors">Compare</a>
            <a href="/use-cases" className="hover:text-[var(--text-primary)] transition-colors">Use Cases</a>
            <a href="/models" className="hover:text-[var(--text-primary)] transition-colors">Models</a>
          </nav>
          <a
            href="/sign-in"
            className="rounded-lg bg-[var(--cta-a)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Sign in
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[var(--hero-a)] to-[var(--hero-b)] text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest opacity-80">
            The AI API discovery layer
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Find the right AI API
            <br />
            for any use case
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg opacity-90">
            Compare 100+ LLM, image, speech, and embedding APIs by latency, pricing,
            reliability, and developer experience. Cut through the noise — pick with confidence.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/apis"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-[var(--hero-a)] shadow hover:opacity-90 transition-opacity"
            >
              Browse APIs
            </a>
            <a
              href="/use-cases"
              className="rounded-lg border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Explore use cases
            </a>
          </div>
        </div>
      </section>

      {/* Featured APIs */}
      <section className="bg-[var(--bg-section)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-2xl font-bold">Top-ranked APIs</h2>
          <p className="mb-10 text-[var(--text-secondary)]">
            Ranked by trust score — a composite of latency, uptime, pricing fairness, and community signal.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_APIS.map((api) => (
              <a
                key={api.slug}
                href={`/apis/${api.slug}`}
                className="group rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold group-hover:text-[var(--hero-a)] transition-colors">{api.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{api.category}</p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {api.trustScore}/10
                  </span>
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Avg latency: <strong>{api.latencyMs}ms</strong>
                </p>
              </a>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/apis" className="text-sm font-medium text-[var(--hero-a)] hover:underline">
              View all APIs →
            </a>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-2xl font-bold">Browse by use case</h2>
          <p className="mb-10 text-[var(--text-secondary)]">
            Start with your goal — we'll surface the right APIs, ranked and compared.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((uc) => (
              <a
                key={uc.slug}
                href={`/use-cases/${uc.slug}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-4 hover:border-[var(--hero-a)] hover:shadow-sm transition-all"
              >
                <span className="text-2xl">{uc.icon}</span>
                <span className="text-sm font-medium">{uc.title}</span>
              </a>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/use-cases" className="text-sm font-medium text-[var(--hero-a)] hover:underline">
              See all use cases →
            </a>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-[var(--line-soft)] bg-[var(--bg-section)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold">
            What makes APIScore different
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "API-level benchmarks",
                body: "Not just model scores — we track real API latency, uptime, rate limits, and pricing quirks so you can pick based on what actually matters.",
              },
              {
                title: "Use-case discovery",
                body: "Search by what you're building, not by model name. We map capabilities to real workflows and surface the best-fit APIs ranked for your context.",
              },
              {
                title: "Side-by-side comparisons",
                body: "Compare any two APIs head-to-head with consistent metrics. Verdict summaries tell you when to pick each one.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-[var(--surface-strong)] p-6 shadow-sm">
                <h3 className="mb-3 font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--line-soft)] bg-[var(--surface-strong)] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div>
              <p className="font-bold">APIScore</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                The developer discovery layer for AI APIs.
              </p>
            </div>
            <div className="flex gap-12 text-sm text-[var(--text-secondary)]">
              <div className="flex flex-col gap-2">
                <p className="font-medium text-[var(--text-primary)]">Discover</p>
                <a href="/apis" className="hover:underline">APIs</a>
                <a href="/compare" className="hover:underline">Compare</a>
                <a href="/use-cases" className="hover:underline">Use Cases</a>
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-medium text-[var(--text-primary)]">Account</p>
                <a href="/sign-in" className="hover:underline">Sign in</a>
                <a href="/sign-up" className="hover:underline">Sign up</a>
                <a href="/dashboard" className="hover:underline">Dashboard</a>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-[var(--text-muted)]">
            © {new Date().getFullYear()} APIScore. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
