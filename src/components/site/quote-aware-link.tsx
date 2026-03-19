"use client"

import Link from "next/link"
import type { MouseEventHandler } from "react"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { openQuoteDialog } from "@/components/site/quote-dialog"
import { toRoute } from "@/lib/route"

type QuoteAwareLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string
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
  const [, setQuoteQuery] = useQueryState(
    "quote",
    parseAsStringLiteral(["open"]).withOptions({
      history: "replace",
      scroll: false,
      shallow: true,
    })
  )
  const hrefString = getHrefString(href)
  const childText = typeof children === "string" ? children : ""
  const label = `${quoteLabel} ${childText}`.trim()
  const shouldOpenQuoteModal = forceQuoteModal || isQuoteIntentLink(label, hrefString)
  const isInternalRoute = hrefString.startsWith("/") || hrefString.startsWith("#")

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event)

    if (event.defaultPrevented || !shouldOpenQuoteModal) {
      return
    }

    event.preventDefault()
    void setQuoteQuery("open")
    openQuoteDialog()
  }

  if (!isInternalRoute) {
    return (
      <a href={hrefString} onClick={handleClick} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Link
      href={toRoute(hrefString)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  )
}
