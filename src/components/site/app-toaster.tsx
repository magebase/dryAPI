"use client"

import { QueryToastListener } from "@/components/site/query-toast-listener"
import { Toaster } from "@/components/ui/sonner"

export function AppToaster() {
  return (
    <>
      <QueryToastListener />
      <Toaster />
    </>
  )
}
