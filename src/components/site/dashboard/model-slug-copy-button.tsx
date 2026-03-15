"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ModelSlugCopyButtonProps = {
  modelSlug: string
  className?: string
}

export function ModelSlugCopyButton({ modelSlug, className }: ModelSlugCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(modelSlug)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("dashboard-copy-slug-button h-8 gap-1.5 px-2 text-[11px] font-medium", className)}
      aria-label={`Copy model slug ${modelSlug}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{copied ? "Copied" : "Copy slug"}</span>
    </Button>
  )
}
