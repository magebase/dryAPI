export const gradientVariants = [
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.98)_0%,rgba(240,248,255,0.96)_100%)]",
  "bg-[linear-gradient(165deg,rgba(252,253,255,0.98)_0%,rgba(236,246,255,0.95)_100%)]",
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.97)_0%,rgba(232,244,255,0.95)_100%)]",
  "bg-[linear-gradient(165deg,rgba(253,255,255,0.98)_0%,rgba(239,248,255,0.95)_100%)]",
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.97)_0%,rgba(235,245,255,0.94)_100%)]",
] as const

export function getGradientVariant(seed = 0): string {
  const index = Math.abs(seed) % gradientVariants.length
  return gradientVariants[index]
}
