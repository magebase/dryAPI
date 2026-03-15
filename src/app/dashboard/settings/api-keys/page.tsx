import dynamic from "next/dynamic"
import { KeyRound } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const KeyTable = dynamic(() => import("@/components/site/dashboard/api-keys/KeyTable"), { ssr: false })

export default function DashboardSettingsApiKeysPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <KeyRound className="size-5" />
            <span>API Keys</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Create, rotate, and revoke keys with environment-level permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-6 text-sm text-zinc-700 dark:text-zinc-200">
          <p className="mb-2">Manage API keys for your environments. Create, rotate, revoke, and inspect usage.</p>
          <div>
            <KeyTable />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
