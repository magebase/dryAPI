"use client"

import Link from "next/link"
import { Menu, Phone, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { tinaField } from "tinacms/dist/react"

import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { QuoteDialog } from "@/components/site/quote-dialog"
import type { SiteConfig } from "@/lib/site-content-schema"

function isCurrentPath(target: string, currentPath: string) {
  if (target === "/") {
    return currentPath === "/"
  }

  return currentPath === target || currentPath.startsWith(`${target}/`)
}

export function SiteHeader({ site, pathname }: { site: SiteConfig; pathname: string }) {
  const headerRef = useRef<HTMLElement | null>(null)
  const [hasScrolled, setHasScrolled] = useState(false)
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null)
  const isMobileMenuOpen = mobileMenuPath === pathname
  const phoneLabel = site.header.phone.label.replace(/\s+/g, " ").trim()

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 18)
    }

    const syncHeaderHeight = () => {
      if (!headerRef.current) {
        return
      }

      document.documentElement.style.setProperty("--site-header-height", `${headerRef.current.offsetHeight}px`)
    }

    handleScroll()
    syncHeaderHeight()

    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", syncHeaderHeight)

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncHeaderHeight) : null
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current)
    }

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", syncHeaderHeight)
      resizeObserver?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.removeProperty("overflow")
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuPath(null)
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.removeProperty("overflow")
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isMobileMenuOpen])

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-500 ease-out ${
        hasScrolled
          ? "border-b border-white/10 bg-[#09111b]/94 shadow-[0_14px_30px_rgba(0,0,0,0.28)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent shadow-none backdrop-blur-0"
      }`}
    >
      <div
        className={`hidden md:block text-center text-[12px] text-slate-200 transition-[background-color,border-color] duration-500 ease-out ${
          hasScrolled ? "border-b border-white/10 bg-[#0d1929]" : "border-b border-transparent bg-transparent"
        }`}
      >
        <p
            className="mx-auto max-w-7xl px-4 py-2 font-medium uppercase tracking-[0.1em]"
          data-tina-field={tinaField(site, "announcement")}
        >
          {site.announcement}
        </p>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:py-4">
        <Link className="flex items-center gap-2 text-white" href="/">
          <span
            className="font-display text-2xl font-semibold tracking-[0.24em] md:text-3xl"
            data-tina-field={tinaField(site.brand, "mark")}
          >
            {site.brand.mark}
          </span>
          <span
            className="hidden text-xs font-medium uppercase tracking-[0.2em] text-slate-400 sm:inline"
            data-tina-field={tinaField(site.brand, "name")}
          >
            {site.brand.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-4 xl:flex">
          {site.header.primaryLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              data-tina-field={tinaField(link)}
              className={`rounded-sm px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.13em] transition ${
                isCurrentPath(link.href, pathname)
                  ? "border border-[#ff9d4a]/45 bg-[#ff8b2b]/14 text-[#ffb67f]"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link
            className="inline-flex items-center gap-2 rounded-sm border border-[#ff9d4a]/45 bg-[#ff8b2b]/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ffb67f] transition hover:border-[#ffb67f]/70 hover:text-white"
            data-tina-field={tinaField(site.header, "phone")}
            href={site.header.phone.href}
          >
            <Phone className="size-3.5" />
            {phoneLabel}
          </Link>
          <QuoteDialog
            site={site}
            triggerClassName="rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] transition hover:brightness-110"
            triggerLabel={site.header.quoteCta.label}
            triggerTinaField={tinaField(site.header, "quoteCta")}
          />
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Link
            aria-label={phoneLabel}
            className="inline-flex items-center justify-center rounded-sm border border-white/15 p-2 text-slate-200 transition hover:border-white hover:text-white"
            data-tina-field={tinaField(site.header, "phone")}
            href={site.header.phone.href}
          >
            <Phone className="size-4" />
          </Link>
          <button
            type="button"
            aria-controls="site-mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            className="inline-flex items-center justify-center rounded-sm border border-white/20 p-2 text-slate-100 transition hover:border-white hover:text-white"
            onClick={() => {
              setMobileMenuPath((currentPath) => (currentPath === pathname ? null : pathname))
            }}
          >
            {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <div
        id="site-mobile-menu"
        className={`xl:hidden overflow-hidden transition-[max-height,opacity,border-color] duration-300 ease-out ${
          isMobileMenuOpen ? "max-h-[75vh] border-t border-white/10 opacity-100" : "max-h-0 border-t border-transparent opacity-0"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 py-4">
          <nav className="grid gap-2">
            {site.header.primaryLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                data-tina-field={tinaField(link)}
                className={`rounded-sm px-3 py-2 text-sm font-semibold uppercase tracking-[0.14em] transition ${
                  isCurrentPath(link.href, pathname)
                    ? "bg-[#ff8b2b]/15 text-[#ff9d4a]"
                    : "text-slate-200 hover:bg-white/5 hover:text-white"
                }`}
                href={link.href}
                onClick={() => setMobileMenuPath(null)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-[#ff9d4a]/45 bg-[#ff8b2b]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffb67f] transition hover:border-[#ffb67f]/70 hover:text-white"
              data-tina-field={tinaField(site.header, "phone")}
              href={site.header.phone.href}
              onClick={() => setMobileMenuPath(null)}
            >
              <Phone className="size-3.5" />
              {phoneLabel}
            </Link>

            <QuoteAwareLink
              className="inline-flex items-center justify-center rounded-sm border border-[#ffb67f]/35 bg-gradient-to-r from-[#ff8b2b] via-[#ff7426] to-[#d45508] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_rgba(255,116,38,0.35)] transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
              forceQuoteModal
              href={site.header.quoteCta.href}
              onClick={() => setMobileMenuPath(null)}
              quoteLabel={site.header.quoteCta.label}
            >
              {site.header.quoteCta.label}
            </QuoteAwareLink>
          </div>
        </div>
      </div>
    </header>
  )
}
