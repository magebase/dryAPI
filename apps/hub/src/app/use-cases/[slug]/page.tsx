import type { Metadata } from "next"

const USE_CASES: Record<
  string,
  {
    title: string
    intent: string
    body: string
    topApis: Array<{ name: string; slug: string; why: string }>
    verdict: string
    codeSnippet: string
  }
> = {
  "best-ai-api-for-chatbots": {
    title: "Best AI API for Chatbots",
    intent: "conversational, multi-turn, streaming responses",
    body: "Chatbot workloads require low latency streaming, strong instruction-following, cost control at scale, and reliable uptime during peak hours. These APIs consistently deliver across those vectors.",
    topApis: [
      { name: "Groq", slug: "groq", why: "Ultra-low latency makes streaming feel instant. Best for UX-critical chatbots." },
      { name: "OpenAI", slug: "openai", why: "GPT-4o-mini offers the best quality/cost ratio for production chatbots." },
      { name: "Anthropic", slug: "anthropic", why: "Claude excels at long-form conversation and complex instruction following." },
    ],
    verdict: "For most chatbot use cases: start with GPT-4o-mini on OpenAI. For real-time streaming UX, Groq. For high-context fidelity, Anthropic.",
    codeSnippet: `// Stream a chatbot response (OpenAI-compatible)
const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: userMessage }],
  stream: true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "")
}`,
  },
  "best-llm-api-for-agents": {
    title: "Best LLM API for AI Agents",
    intent: "tool use, function calling, multi-step reasoning",
    body: "Agent workloads require reliable tool/function calling, constrained JSON output, and the model's ability to reason across multi-step tasks without hallucination. Cost matters less than reliability here.",
    topApis: [
      { name: "OpenAI", slug: "openai", why: "Best function calling support and most agent framework integrations." },
      { name: "Anthropic", slug: "anthropic", why: "Claude 3.5 Sonnet is highly reliable for complex multi-step tool use." },
      { name: "Together AI", slug: "together-ai", why: "Cost-effective for high-volume agent pipelines using open models." },
    ],
    verdict: "For production agents: OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet. For cost-sensitive pipelines: Together AI with Llama 3.1 70B.",
    codeSnippet: `// Function calling example
const result = await openai.chat.completions.create({
  model: "gpt-4o",
  tools: [{ type: "function", function: { name: "search_web", parameters: schema } }],
  messages: [{ role: "user", content: agentPrompt }],
})`,
  },
  "cheapest-gpt-4o-alternative": {
    title: "Cheapest GPT-4o Alternative",
    intent: "cost reduction, budget-conscious inference, similar quality",
    body: "GPT-4o is powerful but expensive at scale. Several providers offer frontier-class quality at significantly lower cost, especially for reasoning and instruction tasks.",
    topApis: [
      { name: "Together AI", slug: "together-ai", why: "Llama 3.1 70B costs ~90% less than GPT-4o with comparable quality on many tasks." },
      { name: "Groq", slug: "groq", why: "Llama 3.1 70B at 800+ tok/s — fastest and very affordable." },
      { name: "OpenRouter", slug: "openrouter", why: "Route to the cheapest available model transparently." },
    ],
    verdict: "For cost-sensitive production: Together AI or Groq with Llama 3.1 70B. Run evals before switching — quality varies by task type.",
    codeSnippet: `// Together AI: Llama 3.1 70B at ~$0.90 per 1M tokens
const res = await fetch("https://api.together.xyz/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: \`Bearer \${TOGETHER_API_KEY}\` },
  body: JSON.stringify({ model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", messages }),
})`,
  },
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const uc = USE_CASES[slug]
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://apiscore.dev"

  if (!uc) return { title: "Use case not found | APIScore" }

  return {
    title: `${uc.title} — API Recommendations`,
    description: `${uc.body.slice(0, 155)}…`,
    alternates: { canonical: `${siteUrl}/use-cases/${slug}` },
    openGraph: {
      type: "website",
      url: `${siteUrl}/use-cases/${slug}`,
      title: `${uc.title} | APIScore`,
      description: uc.intent,
      siteName: "APIScore",
      images: [{ url: `${siteUrl}/og/default.png`, width: 1200, height: 630, alt: uc.title }],
    },
    twitter: { card: "summary_large_image" },
  }
}

export async function generateStaticParams() {
  return Object.keys(USE_CASES).map((slug) => ({ slug }))
}

export default async function UseCasePage({ params }: Props) {
  const { slug } = await params
  const uc = USE_CASES[slug]

  if (!uc) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Use case not found</h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          <a href="/use-cases" className="text-[var(--hero-a)] hover:underline">Browse all use cases →</a>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <a href="/use-cases" className="text-sm text-[var(--text-muted)] hover:underline">← Use cases</a>

      <div className="mt-6">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--hero-a)]">{uc.intent}</p>
        <h1 className="mt-2 text-3xl font-bold">{uc.title}</h1>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">{uc.body}</p>
      </div>

      {/* Top APIs */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold">Top-ranked APIs for this use case</h2>
        <div className="mt-5 space-y-4">
          {uc.topApis.map((api, i) => (
            <div key={api.slug} className="flex gap-4 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-strong)] p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-section)] text-sm font-bold">
                {i + 1}
              </span>
              <div>
                <a
                  href={`/apis/${api.slug}`}
                  className="font-semibold text-[var(--hero-a)] hover:underline"
                >
                  {api.name}
                </a>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{api.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code snippet */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold">Starter code</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-[#111] p-5 text-sm text-green-300">
          <code>{uc.codeSnippet}</code>
        </pre>
      </div>

      {/* Verdict */}
      <div className="mt-10 rounded-xl border border-[var(--line-soft)] bg-[var(--bg-section)] p-6">
        <h2 className="font-semibold">Verdict</h2>
        <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">{uc.verdict}</p>
      </div>
    </main>
  )
}
