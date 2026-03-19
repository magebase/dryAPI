"use client"

import { useState } from "react"
import { createAIShareURLs } from "citemet"
import { BrainCircuit, ExternalLink } from "lucide-react"

import {
  ChatGptIcon,
  ClaudeIcon,
  GeminiIcon,
  GrokIcon,
  MetaAiIcon,
  MistralIcon,
  PerplexityIcon,
} from "./ai-provider-icons"

type AskAiWidgetProps = {
  pageUrl: string
  brandName: string
}

const PROVIDERS = [
  { key: "chatgpt" as const, name: "ChatGPT", Icon: ChatGptIcon },
  { key: "claude" as const, name: "Claude", Icon: ClaudeIcon },
  { key: "perplexity" as const, name: "Perplexity", Icon: PerplexityIcon },
  { key: "gemini" as const, name: "Gemini", Icon: GeminiIcon },
  { key: "grok" as const, name: "Grok", Icon: GrokIcon },
  { key: "meta" as const, name: "Meta AI", Icon: MetaAiIcon },
  { key: "mistral" as const, name: "Mistral", Icon: MistralIcon },
]

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
    <div className="rounded-xl border border-site-surface-2 bg-site-surface-1 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="size-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-site-strong">Ask AI</h4>
      </div>
      <textarea
        aria-label="Type your question for an AI assistant"
        className="w-full resize-none rounded-md border border-site-surface-2 bg-white px-3 py-2 text-sm text-site-strong placeholder:text-site-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about models, parameters, pricing…"
        rows={3}
        value={question}
      />
      <p className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-site-muted">
        Open in
      </p>
      <div className="grid grid-cols-1 gap-1">
        {PROVIDERS.map((provider) => (
          <a
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-site-muted transition hover:bg-white hover:text-site-strong hover:shadow-sm"
            href={urls[provider.key]}
            key={provider.name}
            rel="noopener noreferrer"
            target="_blank"
          >
            <provider.Icon className="shrink-0" size={14} />
            <span className="flex-1">{provider.name}</span>
            <ExternalLink className="size-3 shrink-0 opacity-50" />
          </a>
        ))}
      </div>
    </div>
  )
}
