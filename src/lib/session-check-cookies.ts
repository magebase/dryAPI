export const SESSION_CHECK_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
  "better-auth.account_data",
  "__Secure-better-auth.account_data",
  "better-auth.dont_remember",
  "__Secure-better-auth.dont_remember",
] as const

export function buildSessionCheckCookieHeader(
  readCookieValue: (cookieName: string) => string | undefined,
): string {
  const cookiePairs: string[] = []

  for (const cookieName of SESSION_CHECK_COOKIE_NAMES) {
    const value = readCookieValue(cookieName)?.trim()
    if (!value) {
      continue
    }

    cookiePairs.push(`${cookieName}=${value}`)
  }

  return cookiePairs.join("; ")
}
