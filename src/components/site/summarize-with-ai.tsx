"use client"

import { createAIShareURLs } from "citemet"
import { BrainCircuit, ChevronDown, ExternalLink } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SummarizeWithAiProps = {
  title?: string
  pageUrl: string
  brandName: string
  /** Custom citemet template. Supports {pageUrl} and {brandName} placeholders. */
  template?: string
  /** Button label. Defaults to "Summarize with AI". */
  label?: string
  className?: string
}

export function SummarizeWithAi({
  title,
  pageUrl,
  brandName,
  template,
  label = "Summarize with AI",
  className,
}: SummarizeWithAiProps) {
  const defaultTemplate = title
    ? `Summarize this article: "${title}" — {pageUrl}. Provide the key technical points and practical takeaways for developers evaluating this option. — redirected by {brandName}`
    : `Summarize the content at {pageUrl}. Provide key technical points and practical takeaways. Redirected by {brandName}.`

  const shareURLs = createAIShareURLs({
    pageUrl,
    brandName,
    template: template ?? defaultTemplate,
  })

  const providers = [
    { name: "ChatGPT", url: shareURLs.chatgpt, dotColor: "bg-emerald-500" },
    { name: "Claude", url: shareURLs.claude, dotColor: "bg-orange-500" },
    { name: "Perplexity", url: shareURLs.perplexity, dotColor: "bg-sky-500" },
    { name: "Gemini", url: shareURLs.gemini, dotColor: "bg-blue-500" },
    {
      name: "Copilot",
      url: `https://copilot.microsoft.com/chat?q=${encodeURIComponent(
        `Summarize this article: "${title}" — ${pageUrl}. Provide the key technical points and practical takeaways for developers evaluating this option. — redirected by ${brandName}`
      )}`,
      dotColor: "bg-violet-500",
    },
    { name: "Grok", url: shareURLs.grok, dotColor: "bg-slate-800" },
    { name: "Meta AI", url: shareURLs.meta, dotColor: "bg-indigo-500" },
    { name: "Mistral", url: shareURLs.mistral, dotColor: "bg-amber-500" },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Summarize this page with an AI assistant"
          className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 ${className ?? ""}`}
          type="button"
        >
          <BrainCircuit className="size-3.5 text-violet-500" />
          <span>{label}</span>
          <ChevronDown className="size-3 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
          Open in
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {providers.map((provider) => (
          <DropdownMenuItem key={provider.name} asChild>
            <a
              className="flex cursor-pointer items-center gap-2"
              href={provider.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className={`size-2 shrink-0 rounded-full ${provider.dotColor}`} />
              <span className="flex-1 font-medium text-slate-700">{provider.name}</span>
              <ExternalLink className="size-3 shrink-0 text-slate-400" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
