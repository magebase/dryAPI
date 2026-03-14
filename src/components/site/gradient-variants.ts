export const gradientVariants = [
  "bg-[linear-gradient(165deg,rgba(10,26,36,0.96)_0%,rgba(8,20,30,0.94)_100%)]",
  "bg-[linear-gradient(165deg,rgba(12,30,40,0.95)_0%,rgba(7,22,33,0.93)_100%)]",
  "bg-[linear-gradient(165deg,rgba(16,36,47,0.94)_0%,rgba(9,24,35,0.92)_100%)]",
  "bg-[linear-gradient(165deg,rgba(9,24,35,0.96)_0%,rgba(6,18,28,0.94)_100%)]",
  "bg-[linear-gradient(165deg,rgba(20,40,52,0.92)_0%,rgba(10,24,35,0.9)_100%)]",
] as const

export function getGradientVariant(seed = 0): string {
  const index = Math.abs(seed) % gradientVariants.length
  return gradientVariants[index]
}
