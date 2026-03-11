"use client"

import Link from "next/link"

import { openQuoteDialog } from "@/components/site/quote-dialog"

type QuoteAwareLinkProps = React.ComponentProps<typeof Link> & {
  quoteLabel?: string
  forceQuoteModal?: boolean
}

function getHrefString(href: QuoteAwareLinkProps["href"]) {
  if (typeof href === "string") {
    return href
  }

  return href.pathname ?? ""
}

function isQuoteIntentLink(label: string, href: string) {
  return /\bquote\b/i.test(label) || href === "#quote" || href.startsWith("/quote")
}

export function QuoteAwareLink({
  quoteLabel = "",
  forceQuoteModal = false,
  onClick,
  href,
  children,
  ...props
}: QuoteAwareLinkProps) {
  const hrefString = getHrefString(href)
  const childText = typeof children === "string" ? children : ""
  const label = `${quoteLabel} ${childText}`.trim()
  const shouldOpenQuoteModal = forceQuoteModal || isQuoteIntentLink(label, hrefString)

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event)

        if (event.defaultPrevented || !shouldOpenQuoteModal) {
          return
        }

        event.preventDefault()
        openQuoteDialog()
      }}
      {...props}
    >
      {children}
    </Link>
  )
}
