"use client"

import { useEffect, useState } from "react"

export function useTinaEditMode(): boolean {
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data?.type === "tina:editMode") {
        setIsEditMode(true)
      }
    }

    window.addEventListener("message", handleMessage)

    // Tina visual editing host responds with tina:editMode when loaded in the editor iframe.
    window.parent?.postMessage({ type: "isEditMode" }, window.location.origin)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  return isEditMode
}
