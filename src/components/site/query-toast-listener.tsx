"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"

type ToastKind = "success" | "error" | "info"

const AUTH_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  INVALID_TOKEN: "The verification link is invalid. Request a new email verification link.",
  TOKEN_EXPIRED: "This verification link has expired. Request a new verification email.",
  USER_NOT_FOUND: "We could not find that account. Please register again.",
}

function readToastKind(value: string | null): ToastKind {
  if (value === "success" || value === "error" || value === "info") {
    return value
  }

  return "info"
}

function showToast(kind: ToastKind, title: string, description: string | null, id: string) {
  if (kind === "success") {
    toast.success(title, { id, description: description || undefined })
    return
  }

  if (kind === "error") {
    toast.error(title, { id, description: description || undefined })
    return
  }

  toast(title, { id, description: description || undefined })
}

export function QueryToastListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastToastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || !searchParams) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    const rawToastTitle = params.get("toast")
    const rawToastDescription = params.get("toastDescription")
    const rawToastType = params.get("toastType")
    const authEvent = params.get("auth")
    const authErrorCode = params.get("error")

    let didShowToast = false

    if (authEvent === "verified") {
      const key = `auth:verified:${pathname}`
      if (lastToastKeyRef.current !== key) {
        toast.success("Email verification successful", {
            id: key,
          description: "Your account is verified and ready to use.",
        })
        lastToastKeyRef.current = key
      }
      didShowToast = true
      params.delete("auth")
    }

    if (authErrorCode) {
      const resolvedMessage = AUTH_ERROR_MESSAGE_BY_CODE[authErrorCode]
      if (resolvedMessage) {
        const key = `auth:error:${authErrorCode}:${pathname}`
        if (lastToastKeyRef.current !== key) {
          toast.error("Email verification failed", {
            id: key,
            description: resolvedMessage,
          })
          lastToastKeyRef.current = key
        }
        didShowToast = true
        params.delete("error")
      }
    }

    if (rawToastTitle) {
      const kind = readToastKind(rawToastType)
      const key = `query-toast:${kind}:${rawToastTitle}:${rawToastDescription || ""}:${pathname}`
      if (lastToastKeyRef.current !== key) {
        showToast(kind, rawToastTitle, rawToastDescription, key)
        lastToastKeyRef.current = key
      }

      didShowToast = true
      params.delete("toast")
      params.delete("toastDescription")
      params.delete("toastType")
    }

    if (!didShowToast) {
      return
    }

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    const currentQuery = searchParams.toString()
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname

    if (nextUrl === currentUrl) {
      return
    }

    // Use a history replacement to clear ephemeral toast params without
    // triggering a full App Router navigation.
    window.history.replaceState(window.history.state, "", nextUrl)
  }, [pathname, searchParams])

  return null
}
