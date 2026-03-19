import type { ComponentPropsWithoutRef } from "react"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type BlogSectionMarkdownProps = {
  content: string
  dataTinaField?: string
}

function linkIsExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export function BlogSectionMarkdown({ content, dataTinaField }: BlogSectionMarkdownProps) {
  return (
    <div className="mt-3 text-base leading-relaxed text-slate-600" data-tina-field={dataTinaField}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ children }) => <h3 className="mt-5 text-lg font-semibold text-site-strong">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-4 text-base font-semibold text-site-strong">{children}</h4>,
          p: ({ children }) => <p className="mt-3 first:mt-0">{children}</p>,
          ul: ({ children }) => <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary">{children}</ul>,
          ol: ({ children }) => <ol className="mt-3 list-decimal space-y-2 pl-6 marker:text-primary">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
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
            <blockquote className="mt-4 border-l-2 border-primary/60 pl-4 italic text-slate-700">{children}</blockquote>
          ),
          hr: () => <hr className="my-5 border-slate-200" />,
          code: ({ inline, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) =>
            inline ? (
              <code {...props} className="rounded bg-[var(--site-surface-0)] px-1 py-0.5 text-[0.93em] text-primary">
                {children}
              </code>
            ) : (
              <code
                {...props}
                className="mt-3 block overflow-x-auto rounded-md border border-slate-200 bg-[var(--site-surface-0)] px-4 py-3 text-sm text-slate-700"
              >
                {children}
              </code>
            ),
          table: ({ children }) => (
            <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--site-surface-1)] text-site-strong">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
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
