"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { tinaField } from "tinacms/dist/react"

import { DryApiLogo } from "@/components/site/dryapi-logo"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
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
  const [scrollProgress, setScrollProgress] = useState(0)
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null)
  const isMobileMenuOpen = mobileMenuPath === pathname
  const utilityCtaLabel = site.header.phone.label.replace(/\s+/g, " ").trim()

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setHasScrolled(y > 18)
      setScrollProgress((current) => {
        const next = Math.min(1, Math.max(0, y / 260))
        return Math.abs(next - current) > 0.01 ? next : current
      })
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

  const headerMotionStyle = {
    transform: `translateY(${(-8 * scrollProgress).toFixed(2)}px)`,
  }
  const announcementStyle = {
    opacity: 1 - scrollProgress * 0.3,
    transform: `translateY(${(-4 * scrollProgress).toFixed(2)}px)`,
  }
  const navMotionStyle = {
    transform: `scale(${(1 - scrollProgress * 0.025).toFixed(3)})`,
  }

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter,box-shadow,transform] duration-500 ease-out ${
        hasScrolled
          ? "border-b border-white/10 bg-[#09111b]/94 shadow-[0_14px_30px_rgba(0,0,0,0.28)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent shadow-none backdrop-blur-0"
      }`}
      style={headerMotionStyle}
    >
      <div
        className={`hidden md:block text-center text-[12px] text-slate-200 transition-[background-color,border-color,opacity,transform] duration-500 ease-out ${
          hasScrolled ? "border-b border-white/10 bg-[#0d1929]" : "border-b border-transparent bg-transparent"
        }`}
        style={announcementStyle}
      >
        <p
          className="mx-auto max-w-7xl px-4 py-2 font-medium uppercase tracking-[0.1em]"
          data-tina-field={tinaField(site, "announcement")}
        >
          {site.announcement}
        </p>
      </div>

      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-[padding] duration-300 ease-out ${
          hasScrolled ? "py-2.5 md:py-3" : "py-3 md:py-4"
        }`}
      >
        <Link className="flex items-center text-white" href="/" style={navMotionStyle}>
          <DryApiLogo
            mark={site.brand.mark}
            markDataTinaField={tinaField(site.brand, "mark")}
            name={site.brand.name}
            nameClassName="text-[11px]"
            nameDataTinaField={tinaField(site.brand, "name")}
            size="lg"
            tone="dark"
          />
        </Link>

        <nav className="hidden items-center gap-4 xl:flex" style={navMotionStyle}>
          {site.header.primaryLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              data-tina-field={tinaField(link)}
              className={`rounded-sm px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.13em] transition ${
                isCurrentPath(link.href, pathname)
                  ? "border border-primary/45 bg-primary/15 text-primary"
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
            className="inline-flex items-center gap-2 rounded-sm border border-primary/45 bg-primary/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition hover:border-accent/70 hover:text-white"
            data-tina-field={tinaField(site.header, "phone")}
            href={site.header.phone.href}
          >
            {utilityCtaLabel}
          </Link>
          <QuoteAwareLink
            className="rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lg transition hover:brightness-110"
            data-tina-field={tinaField(site.header, "quoteCta")}
            href={site.header.quoteCta.href}
            quoteLabel={site.header.quoteCta.label}
          >
            {site.header.quoteCta.label}
          </QuoteAwareLink>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Link
            aria-label={utilityCtaLabel}
            className="inline-flex items-center justify-center rounded-sm border border-white/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-white hover:text-white"
            data-tina-field={tinaField(site.header, "phone")}
            href={site.header.phone.href}
          >
            {utilityCtaLabel}
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
                    ? "bg-primary/15 text-primary"
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
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-primary/45 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:border-accent/70 hover:text-white"
              data-tina-field={tinaField(site.header, "phone")}
              href={site.header.phone.href}
              onClick={() => setMobileMenuPath(null)}
            >
              {utilityCtaLabel}
            </Link>

            <QuoteAwareLink
              className="inline-flex items-center justify-center rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-lg transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
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
