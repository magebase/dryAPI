export function resolveAuthCallbackErrorMessage(
  error: string | null | undefined,
  message: string | null | undefined,
  fallbackMessage: string,
): string {
  const normalizedError = error?.trim().toLowerCase() || ""
  const normalizedMessage = message?.trim() || ""

  if (normalizedError === "invalid_code" || normalizedError === "invalid_grant") {
    return "Google sign-in could not complete. Verify the OAuth client secret and redirect URI."
  }

  if (normalizedError === "access_denied") {
    return "Google sign-in was canceled. Try again to continue."
  }

  if (normalizedMessage.length > 0) {
    return normalizedMessage
  }

  return fallbackMessage
}