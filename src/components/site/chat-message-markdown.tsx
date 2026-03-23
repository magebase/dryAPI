"use client"

import type { ComponentPropsWithoutRef } from "react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

type ChatMessageMarkdownProps = {
  content: string
  className?: string
}

function linkIsExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export function ChatMessageMarkdown({ content, className }: ChatMessageMarkdownProps) {
  return (
    <div className={cn("break-words text-sm leading-relaxed text-site-strong", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ children }) => <h3 className="mt-4 text-base font-semibold text-site-strong">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-3 text-sm font-semibold text-site-strong">{children}</h4>,
          p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-primary">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-primary">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          a: ({ href = "", children, ...props }) => {
            const isExternal = linkIsExternal(href)

            return (
              <a
                {...props}
                className="text-primary underline decoration-primary/60 underline-offset-4 transition hover:text-accent"
                href={href}
                rel={isExternal ? "noopener noreferrer" : undefined}
                target={isExternal ? "_blank" : undefined}
              >
                {children}
              </a>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="mt-3 border-l-2 border-primary/60 pl-4 italic text-slate-700">{children}</blockquote>
          ),
          hr: () => <hr className="my-4 border-slate-200" />,
          code: ({ inline, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) =>
            inline ? (
              <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.93em] text-primary">
                {children}
              </code>
            ) : (
              <code
                {...props}
                className="mt-2 block overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {children}
              </code>
            ),
          table: ({ children }) => (
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--site-surface-1)] text-site-strong">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 align-top text-slate-600">{children}</td>,
          strong: ({ children }) => <strong className="font-semibold text-site-strong">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}