"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import { BellRing, KeyRound, Settings2, ShieldCheck, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"

type SettingsNavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const settingsNavItems: SettingsNavItem[] = [
  {
    href: "/dashboard/settings/general",
    label: "General",
    icon: Settings2,
  },
  {
    href: "/dashboard/settings/api-keys",
    label: "API Keys",
    icon: KeyRound,
  },
  {
    href: "/dashboard/settings/webhooks",
    label: "Webhooks",
    icon: BellRing,
  },
  {
    href: "/dashboard/settings/security",
    label: "Security",
    icon: ShieldCheck,
  },
  {
    href: "/dashboard/settings/account",
    label: "Account",
    icon: UserRound,
  },
]

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SettingsSectionNav() {
  const pathname = usePathname() ?? ""

  return (
    <aside className="h-fit rounded-xl border border-zinc-200/80 bg-white/90 p-2 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-900/80">
      <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Settings
      </p>
      <nav className="space-y-1">
        {settingsNavItems.map((item) => {
          const active = isActiveRoute(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-zinc-300/90 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
