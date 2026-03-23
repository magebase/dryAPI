export const CAPTCHA_RESPONSE_HEADER = "x-captcha-response"

export function buildCaptchaHeaders(token: string): Record<string, string> | undefined {
  const normalized = token.trim()

  if (!normalized) {
    return undefined
  }

  return {
    [CAPTCHA_RESPONSE_HEADER]: normalized,
  }
}