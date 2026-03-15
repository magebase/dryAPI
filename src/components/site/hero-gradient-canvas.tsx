"use client"

import { useEffect } from "react"

const HERO_GRADIENT_SEED = "b2.2898"
const HERO_GRADIENT_CANVAS_ID = "landing-hero-gradient-canvas"

export function HeroGradientCanvas() {
  useEffect(() => {
    const networkInfo = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const saveData = networkInfo?.saveData === true
    const lowCpu = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 6
    const smallViewport = window.innerWidth < 1024

    if (prefersReducedMotion || saveData || lowCpu || smallViewport) {
      return
    }

    let isMounted = true
    let cleanup: (() => void) | null = null

    const mount = async () => {
      const { default: gradientGL } = await import("gradient-gl")
      const program = await gradientGL(HERO_GRADIENT_SEED, `#${HERO_GRADIENT_CANVAS_ID}`)

      if (!isMounted) {
        program.destroy()
        return
      }

      cleanup = () => {
        program.destroy()
      }
    }

    mount().catch(() => {
      // Keep the static fallback gradient if WebGL initialization fails.
    })

    return () => {
      isMounted = false
      cleanup?.()
    }
  }, [])

  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      id={HERO_GRADIENT_CANVAS_ID}
    />
  )
}
