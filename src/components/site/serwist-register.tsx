"use client"

import { useEffect } from "react"

export function SerwistRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return
    }

    if (!("serviceWorker" in navigator)) {
      return
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep startup quiet when service worker registration is unavailable.
    })
  }, [])

  return null
}
