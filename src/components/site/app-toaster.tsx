import { Suspense } from "react"
import { QueryToastListener } from "@/components/site/query-toast-listener"
import { Toaster } from "@/components/ui/sonner"

export function AppToaster() {
  return (
    <>
      <Suspense fallback={null}>
        <QueryToastListener />
      </Suspense>
      <Toaster />
    </>
  )
}
