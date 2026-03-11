export const gradientVariants = [
  "bg-[#122235]/95",
  "bg-[#162a40]/94",
  "bg-[#1a3047]/93",
  "bg-[#102134]/96",
  "bg-[#1d364f]/92",
] as const

export function getGradientVariant(seed = 0): string {
  const index = Math.abs(seed) % gradientVariants.length
  return gradientVariants[index]
}
