"use client"

import { useEffect, useMemo, useRef } from "react"
import Script from "next/script"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          action?: string
          callback?: (token: string) => void
          "error-callback"?: () => void
          "expired-callback"?: () => void
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

type TurnstileWidgetProps = {
  action: string
  onTokenChange: (token: string) => void
  onError?: () => void
  resetKey?: string | number
  className?: string
}

function getSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""
}

export function TurnstileWidget({
  action,
  onTokenChange,
  onError,
  resetKey,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = getSiteKey()

  const resetSignature = useMemo(() => `${action}-${String(resetKey ?? "")}`, [action, resetKey])

  useEffect(() => {
    if (!siteKey) {
      return
    }

    let cancelled = false

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return
      }

      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }

      onTokenChange("")

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => {
          onTokenChange(token)
        },
        "error-callback": () => {
          onTokenChange("")
          onError?.()
        },
        "expired-callback": () => {
          onTokenChange("")
        },
      })
    }

    const waitForTurnstile = () => {
      if (cancelled) {
        return
      }

      if (window.turnstile) {
        render()
        return
      }

      window.setTimeout(waitForTurnstile, 80)
    }

    waitForTurnstile()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [action, onError, onTokenChange, resetSignature, siteKey])

  if (!siteKey) {
    return null
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div className={className} ref={containerRef} />
    </>
  )
}
