import type { ReactNode } from "react"

import { DashboardShell } from "@/components/site/dashboard/dashboard-shell"

type DashboardLayoutProps = {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardShell>{children}</DashboardShell>
}
