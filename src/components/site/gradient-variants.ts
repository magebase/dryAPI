export const gradientVariants = [
  "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500",
  "bg-gradient-to-r from-orange-600 to-orange-500",
  "bg-gradient-to-r from-yellow-600 to-red-600",
  "bg-gradient-to-r from-fuchsia-500 via-red-600 to-orange-400",
  "bg-[conic-gradient(at_left,_var(--tw-gradient-stops))] from-yellow-200 via-red-500 to-fuchsia-500",
] as const

export function getGradientVariant(seed = 0): string {
  const index = Math.abs(seed) % gradientVariants.length
  return gradientVariants[index]
}
