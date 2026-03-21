export function isPhpProbePath(pathname: string): boolean {
  return pathname.toLowerCase().includes(".php")
}