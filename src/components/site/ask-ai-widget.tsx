"use client"

import { useState } from "react"
import { createAIShareURLs } from "citemet"
import { BrainCircuit, ExternalLink } from "lucide-react"

type AskAiWidgetProps = {
  pageUrl: string
  brandName: string
}

const PROVIDERS = [
  {
    key: "chatgpt" as const,
    name: "ChatGPT",
    iconSrc: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
  },
  {
    key: "claude" as const,
    name: "Claude",
    iconSrc: "https://cdn.simpleicons.org/claude/D97757",
  },
  {
    key: "perplexity" as const,
    name: "Perplexity",
    iconSrc: "https://cdn.simpleicons.org/perplexity/22D3EE",
  },
  {
    key: "gemini" as const,
    name: "Gemini",
    iconSrc: "https://cdn.simpleicons.org/googlegemini/7A8CFF",
  },
  {
    key: "grok" as const,
    name: "Grok",
    iconSrc: "https://x.ai/favicon.ico",
  },
  {
    key: "meta" as const,
    name: "Meta AI",
    iconSrc: "https://cdn.simpleicons.org/meta/4B74F6",
  },
  {
    key: "mistral" as const,
    name: "Mistral",
    iconSrc: "https://cdn.simpleicons.org/mistralai/F97316",
  },
]

function ProviderBrandIcon({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="inline-flex size-4 items-center justify-center rounded-sm bg-white/15 text-[9px] font-semibold text-slate-200">
        {name[0] ?? "?"}
      </span>
    )
  }

  return (
    <span className="inline-flex size-4 items-center justify-center rounded-sm bg-white/10 p-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`${name} icon`}
        className="size-3.5 object-contain"
        loading="lazy"
        onError={() => setFailed(true)}
        src={src}
      />
    </span>
  )
}

export function AskAiWidget({ pageUrl, brandName }: AskAiWidgetProps) {
  const [question, setQuestion] = useState("")

  const effectiveQuestion = question.trim()
    ? question.trim()
    : `Help me understand the models and capabilities available on the {brandName} AI playground`

  const urls = createAIShareURLs({
    pageUrl,
    brandName,
    template: `${effectiveQuestion} — Playground at {pageUrl}, powered by {brandName}.`,
  })

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#0f1218]/98 to-[#070a10]/98 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="size-4 text-emerald-300" />
        <h4 className="text-xs uppercase tracking-[0.18em] text-slate-300">Ask AI</h4>
      </div>
      <textarea
        aria-label="Type your question for an AI assistant"
        className="w-full resize-none rounded-md border border-white/12 bg-black/25 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about models, parameters, pricing…"
        rows={3}
        value={question}
      />
      <p className="mb-2 mt-3 text-[10px] uppercase tracking-[0.14em] text-slate-500">
        Open in
      </p>
      <div className="grid grid-cols-1 gap-1">
        {PROVIDERS.map((provider) => (
          <a
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/8 hover:text-white"
            href={urls[provider.key]}
            key={provider.name}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ProviderBrandIcon name={provider.name} src={provider.iconSrc} />
            <span className="flex-1">{provider.name}</span>
            <ExternalLink className="size-3 shrink-0 opacity-50" />
          </a>
        ))}
      </div>
    </div>
  )
}
