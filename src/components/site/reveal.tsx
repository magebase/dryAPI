"use client"

import { createContext, useContext, useEffect, useId, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

type RevealProps = {
  as?: "section" | "div" | "article"
  id?: string
  className?: string
  revealKey?: string
  delay?: number
  duration?: number
  y?: number
  once?: boolean
  allowNested?: boolean
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className" | "id">

const RevealDepthContext = createContext(0)

export function Reveal({
  as = "section",
  id,
  className,
  revealKey,
  delay = 0,
  duration = 0.45,
  y = 24,
  once = true,
  allowNested = true,
  children,
  ...rest
}: RevealProps) {
  const depth = useContext(RevealDepthContext)
  const isNested = depth > 0
  const fallbackRevealKey = useId()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const updateReducedMotion = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updateReducedMotion()
    mediaQuery.addEventListener("change", updateReducedMotion)

    return () => {
      mediaQuery.removeEventListener("change", updateReducedMotion)
    }
  }, [])

  const shouldAnimate = !prefersReducedMotion && (!isNested || allowNested)
  const dataField = (rest as Record<string, unknown>)["data-tina-field"]
  const resolvedRevealKey = useMemo(() => {
    if (revealKey) return revealKey
    if (id) return `id:${id}`
    if (typeof dataField === "string" && dataField.length > 0) return `tina:${dataField}`
    return `uid:${fallbackRevealKey}`
  }, [dataField, fallbackRevealKey, id, revealKey])

  const delayMs = Math.max(0, Math.round(delay * 1000))
  const durationMs = Math.max(150, Math.round(duration * 1000))
  const Element = as

  if (!shouldAnimate) {
    return (
      <RevealDepthContext.Provider value={depth + 1}>
        <Element className={cn(className)} id={id} {...rest}>
          {children}
        </Element>
      </RevealDepthContext.Provider>
    )
  }

  return (
    <RevealDepthContext.Provider value={depth + 1}>
      <Element
        className={cn(className)}
        data-aos={y === 0 ? "fade" : "fade-up"}
        data-aos-anchor-placement="top-bottom"
        data-aos-delay={delayMs > 0 ? delayMs : undefined}
        data-aos-duration={durationMs}
        data-aos-easing="ease-out-cubic"
        data-aos-id={resolvedRevealKey}
        data-aos-offset={80}
        data-aos-once={once ? "true" : "false"}
        id={id}
        {...rest}
      >
        {children}
      </Element>
    </RevealDepthContext.Provider>
  )
}
