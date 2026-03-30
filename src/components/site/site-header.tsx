"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tinaField } from "tinacms/dist/react";

import { BrandLogo } from "@/components/site/brand-logo";
import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { getClientAuthSessionSnapshot } from "@/lib/client-auth-session";
import { toRoute } from "@/lib/route";
import type { SiteConfig } from "@/lib/site-content-schema";

function isCurrentPath(target: string, currentPath: string) {
  if (target === "/") {
    return currentPath === "/";
  }

  return currentPath === target || currentPath.startsWith(`${target}/`);
}

export function SiteHeader({
  site,
  pathname,
}: {
  site: SiteConfig;
  pathname: string;
}) {
  const isHome = pathname === "/";
  const isHomeRef = useRef(isHome);
  isHomeRef.current = isHome;
  const headerRef = useRef<HTMLElement | null>(null);
  const [hasScrolled, setHasScrolled] = useState(!isHome);
  const [scrollProgress, setScrollProgress] = useState(isHome ? 0 : 1);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const isMobileMenuOpen = mobileMenuPath === pathname;
  const utilityCtaLabel = site.header.phone.label.replace(/\s+/g, " ").trim();
  const quoteCtaLabel = isSignedIn ? "Dashboard" : site.header.quoteCta.label;
  const quoteCtaHref = isSignedIn ? "/dashboard" : site.header.quoteCta.href;
  const useSolidPalette =
    hasScrolled ||
    pathname === "/blog" ||
    pathname.includes("/blog/") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/models");

  useEffect(() => {
    const handleScroll = () => {
      if (!isHomeRef.current && pathname !== "/blog") return;
      const y = window.scrollY;
      setHasScrolled(y > 18 || pathname === "/blog");
      setScrollProgress((current) => {
        const next = pathname === "/blog" ? 1 : Math.min(1, Math.max(0, y / 260));
        return Math.abs(next - current) > 0.01 ? next : current;
      });
    };

    const syncHeaderHeight = () => {
      if (!headerRef.current) {
        return;
      }

      document.documentElement.style.setProperty(
        "--site-header-height",
        `${headerRef.current.offsetHeight}px`,
      );
    };

    handleScroll();
    syncHeaderHeight();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", syncHeaderHeight);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncHeaderHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuPath(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isHome) {
      const y = window.scrollY;
      setHasScrolled(y > 18);
      setScrollProgress(Math.min(1, Math.max(0, y / 260)));
    } else if (pathname === "/blog") {
      setHasScrolled(true);
      setScrollProgress(1);
    } else {
      setHasScrolled(true);
      setScrollProgress(1);
    }
  }, [isHome, pathname]);

  useEffect(() => {
    let active = true;

    void getClientAuthSessionSnapshot()
      .then((snapshot) => {
        if (!active) {
          return;
        }

        setIsSignedIn(Boolean(snapshot.user && snapshot.session));
      })
      .catch(() => {
        if (active) {
          setIsSignedIn(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const announcementStyle = {
    opacity: 1 - scrollProgress * 0.3,
    transform: `translateY(${(-1 * scrollProgress).toFixed(2)}px)`,
  };
  const navMotionStyle = {
    transform: `scale(${(1 - scrollProgress * 0.025).toFixed(3)})`,
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter,box-shadow,transform] duration-500 animate-in slide-in-from-top-24 ease-out ${
        useSolidPalette
          ? "border-b border-[color:var(--border)] bg-[var(--site-surface-0)]/94 shadow backdrop-blur-md"
          : "border-b border-transparent bg-transparent shadow-none backdrop-blur-0"
      }`}
    >
      <div
        className={`hidden text-center text-[12px] transition-[background-color,border-color,opacity,transform] duration-500 ease-out md:block ${
          useSolidPalette
            ? "border-b border-[color:var(--border)] bg-[var(--site-surface-0)] text-site-muted"
            : "border-b border-transparent bg-transparent text-site-inverse-muted"
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
        <Link
          className={`flex items-center ${useSolidPalette ? "text-site-strong" : "text-site-inverse"}`}
          href={toRoute("/")}
          style={navMotionStyle}
        >
          <BrandLogo
            mark={site.brand.mark}
            markDataTinaField={tinaField(site.brand, "mark")}
            name={site.brand.name}
            nameClassName="text-[11px]"
            nameDataTinaField={tinaField(site.brand, "name")}
            size="lg"
            tone={useSolidPalette ? "dark" : "light"}
          />
        </Link>

        <nav
          className="hidden items-center gap-4 xl:flex"
          style={navMotionStyle}
        >
          {site.header.primaryLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              data-tina-field={tinaField(link)}
              className={`rounded-sm px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.13em] transition ${
                isCurrentPath(link.href, pathname)
                  ? useSolidPalette
                    ? "border border-primary/45 bg-primary/15 text-primary"
                    : "border border-white/36 bg-white/10 text-site-inverse"
                  : useSolidPalette
                    ? "text-site-muted hover:bg-white/5 hover:text-[color:var(--site-text-strong)]"
                    : "text-site-inverse-muted hover:bg-white/10 hover:text-[color:var(--site-text-inverse)]"
              }`}
              href={toRoute(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link
            className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              useSolidPalette
                ? "border border-primary/45 bg-primary/10 text-primary hover:border-accent/70 hover:text-[color:var(--site-text-strong)]"
                : "border border-white/34 bg-white/8 text-site-inverse hover:border-white/48 hover:text-[color:var(--site-text-inverse)]"
            }`}
            data-tina-field={tinaField(site.header, "phone")}
            href={toRoute(site.header.phone.href)}
          >
            {utilityCtaLabel}
          </Link>
          {isSignedIn ? (
            <Link
              className="rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lg transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
              href={toRoute(quoteCtaHref)}
            >
              {quoteCtaLabel}
            </Link>
          ) : (
            <QuoteAwareLink
              className="rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lg transition hover:brightness-110"
              data-tina-field={tinaField(site.header, "quoteCta")}
              href={quoteCtaHref}
              quoteLabel={quoteCtaLabel}
            >
              {quoteCtaLabel}
            </QuoteAwareLink>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Link
            aria-label={utilityCtaLabel}
            className={`inline-flex items-center justify-center rounded-sm px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              useSolidPalette
                ? "border border-[color:var(--border)] text-site-muted hover:border-primary/40 hover:text-[color:var(--site-text-strong)]"
                : "border border-white/32 text-site-inverse hover:border-white/48 hover:text-[color:var(--site-text-inverse)]"
            }`}
            data-tina-field={tinaField(site.header, "phone")}
            href={toRoute(site.header.phone.href)}
          >
            {utilityCtaLabel}
          </Link>
          <button
            type="button"
            aria-controls="site-mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            className={`inline-flex items-center justify-center rounded-sm p-2 transition ${
              useSolidPalette
                ? "border border-[color:var(--border)] text-site-strong hover:border-primary/40"
                : "border border-white/32 text-site-inverse hover:border-white/48"
            }`}
            onClick={() => {
              setMobileMenuPath((currentPath) =>
                currentPath === pathname ? null : pathname,
              );
            }}
          >
            {isMobileMenuOpen ? (
              <X className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div
        id="site-mobile-menu"
        className={`xl:hidden overflow-hidden transition-[max-height,opacity,border-color] duration-300 ease-out ${
          isMobileMenuOpen
            ? "max-h-[75vh] border-t border-[color:var(--border)] opacity-100"
            : "max-h-0 border-t border-transparent opacity-0"
        }`}
      >
        <div className="mx-auto max-w-7xl bg-[var(--site-surface-0)]/96 px-4 py-4 backdrop-blur-md">
          <nav className="grid gap-2">
            {site.header.primaryLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                data-tina-field={tinaField(link)}
                className={`rounded-sm px-3 py-2 text-sm font-semibold uppercase tracking-[0.14em] transition ${
                  isCurrentPath(link.href, pathname)
                    ? "bg-primary/15 text-primary"
                    : "text-site-muted hover:bg-white/5 hover:text-[color:var(--site-text-strong)]"
                }`}
                href={toRoute(link.href)}
                onClick={() => setMobileMenuPath(null)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-primary/45 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:border-accent/70 hover:text-[color:var(--site-text-strong)]"
              data-tina-field={tinaField(site.header, "phone")}
              href={toRoute(site.header.phone.href)}
              onClick={() => setMobileMenuPath(null)}
            >
              {utilityCtaLabel}
            </Link>

            {isSignedIn ? (
              <Link
                className="inline-flex items-center justify-center rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-lg transition hover:brightness-110"
                data-tina-field={tinaField(site.header, "quoteCta")}
                href={toRoute(quoteCtaHref)}
                onClick={() => setMobileMenuPath(null)}
              >
                {quoteCtaLabel}
              </Link>
            ) : (
              <QuoteAwareLink
                className="inline-flex items-center justify-center rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-lg transition hover:brightness-110"
                data-tina-field={tinaField(site.header, "quoteCta")}
                href={quoteCtaHref}
                onClick={() => setMobileMenuPath(null)}
                quoteLabel={quoteCtaLabel}
              >
                {quoteCtaLabel}
              </QuoteAwareLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
