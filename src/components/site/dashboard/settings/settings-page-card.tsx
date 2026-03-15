import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type SettingsPageCardProps = {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
}

export function SettingsPageCard({ title, description, icon: Icon, children }: SettingsPageCardProps) {
  return (
    <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
      <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
        <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          <Icon className="size-5" />
          <span>{title}</span>
        </CardTitle>
        <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-6 text-sm text-zinc-700 dark:text-zinc-200">{children}</CardContent>
    </Card>
  )
}
