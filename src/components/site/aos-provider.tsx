"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import AOS from "aos"

export function AosProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    AOS.init({
      duration: 450,
      easing: "ease-out-cubic",
      once: true,
      mirror: false,
      offset: 120,
    })
  }, [])

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      AOS.refreshHard()
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [pathname])

  return <>{children}</>
}
