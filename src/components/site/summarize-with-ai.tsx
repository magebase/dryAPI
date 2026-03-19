"use client"

import { createAIShareURLs } from "citemet"
import { BrainCircuit, ChevronDown, ExternalLink } from "lucide-react"

import {
  ChatGptIcon,
  ClaudeIcon,
  CopilotIcon,
  GeminiIcon,
  GrokIcon,
  MetaAiIcon,
  MistralIcon,
  PerplexityIcon,
} from "./ai-provider-icons"

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
    { name: "ChatGPT", url: shareURLs.chatgpt, Icon: ChatGptIcon },
    { name: "Claude", url: shareURLs.claude, Icon: ClaudeIcon },
    { name: "Perplexity", url: shareURLs.perplexity, Icon: PerplexityIcon },
    { name: "Gemini", url: shareURLs.gemini, Icon: GeminiIcon },
    {
      name: "Copilot",
      url: `https://copilot.microsoft.com/chat?q=${encodeURIComponent(
        `Summarize this article: "${title}" — ${pageUrl}. Provide the key technical points and practical takeaways for developers evaluating this option. — redirected by ${brandName}`
      )}`,
      Icon: CopilotIcon,
    },
    { name: "Grok", url: shareURLs.grok, Icon: GrokIcon },
    { name: "Meta AI", url: shareURLs.meta, Icon: MetaAiIcon },
    { name: "Mistral", url: shareURLs.mistral, Icon: MistralIcon },
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
          <ChevronDown className="size-3 text-site-soft" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-site-soft">
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
              <provider.Icon className="shrink-0" size={14} />
              <span className="flex-1 font-medium text-slate-700">{provider.name}</span>
              <ExternalLink className="size-3 shrink-0 text-site-soft" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
