"use client"

import dynamic from "next/dynamic"

const AdminApp = dynamic(
  () => import("@/components/admin/admin-app").then((module) => module.AdminApp),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm text-muted-foreground">Loading CMS…</p>,
  }
)

export function AdminPageShell() {
  return <AdminApp />
}
