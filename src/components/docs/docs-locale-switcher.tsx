"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { localizePath, stripLocalePrefix, SUPPORTED_LOCALES } from "@/lib/i18n"
import { toRoute } from "@/lib/route"

export function DocsLocaleSwitcher() {
  const pathname = usePathname() || "/docs"
  const localizedBasePath = stripLocalePrefix(pathname)

  return (
    <div className="flex items-center gap-1 rounded-full border border-fd-border bg-fd-card/70 p-1 text-xs uppercase tracking-[0.2em]">
      {SUPPORTED_LOCALES.map((locale) => {
        const href = localizePath(localizedBasePath, locale)
        const isActive = href === pathname

        return (
          <Link
            key={locale}
            href={toRoute(href)}
            className={[
              "rounded-full px-2.5 py-1 transition-colors",
              isActive
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            ].join(" ")}
          >
            {locale}
          </Link>
        )
      })}
    </div>
  )
}