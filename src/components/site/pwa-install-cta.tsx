"use client"

import { Download, X } from "lucide-react"
import { useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
}

const DISMISS_STORAGE_KEY = "genfix-pwa-install-cta-dismissed"

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false
  }

  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

function getDismissedFromStorage() {
  if (typeof window === "undefined") {
    return false
  }

  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function PwaInstallCta() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(getDismissedFromStorage)
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  if (dismissed || isStandalone || !deferredPrompt) {
    return null
  }

  const handleInstall = async () => {
    const promptEvent = deferredPrompt

    if (!promptEvent) {
      return
    }

    await promptEvent.prompt()
    await promptEvent.userChoice
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)

    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1")
    } catch {
      // Ignore storage errors so the CTA can still be hidden for this session.
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 sm:inset-x-auto sm:left-4 sm:max-w-sm">
      <div className="rounded-md border border-primary/45 bg-[#0c1725]/94 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.36)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Install App</p>
            <p className="mt-1 text-xs text-slate-200">Add GenFix to your home screen for faster access.</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            className="shrink-0 rounded-sm border border-white/15 p-1 text-slate-300 transition hover:border-white hover:text-white"
            onClick={handleDismiss}
          >
            <X className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-primary/40 bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-lg transition hover:brightness-110"
          onClick={() => {
            void handleInstall()
          }}
        >
          <Download className="size-3.5" />
          Install App
        </button>
      </div>
    </div>
  )
}
