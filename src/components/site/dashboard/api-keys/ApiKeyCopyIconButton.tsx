"use client"

import React, { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  label: string
  disabled?: boolean
  className?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  onCopyError?: () => void
}

export default function ApiKeyCopyIconButton({
  value,
  label,
  disabled,
  className,
  variant = "ghost",
  size = "icon-sm",
  onCopyError,
}: Props) {
  const [copied, setCopied] = useState(false)
  const resetTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current)
      }

      // Keep success feedback visible long enough to confirm action.
      resetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        resetTimeoutRef.current = null
      }, 5000)
    } catch {
      setCopied(false)
      onCopyError?.()
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => {
        void handleCopy()
      }}
      disabled={disabled}
      className={className}
      aria-label={label}
      title={label}
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <Copy
          className={cn(
            "size-4 text-muted-foreground transition-all duration-200",
            copied ? "scale-75 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <Check
          className={cn(
            "absolute size-4 text-green-600 transition-all duration-200 dark:text-green-400",
            copied ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        />
      </span>
      <span className="sr-only">{label}</span>
    </Button>
  )
}
