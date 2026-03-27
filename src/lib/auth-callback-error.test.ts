import { describe, expect, it } from "vitest"

import { resolveAuthCallbackErrorMessage } from "@/lib/auth-callback-error"

describe("resolveAuthCallbackErrorMessage", () => {
  it("maps provider callback failures to actionable guidance", () => {
    expect(
      resolveAuthCallbackErrorMessage(
        "invalid_code",
        null,
        "Unable to continue with Google.",
      ),
    ).toBe(
      "Google sign-in could not complete. Verify the OAuth client secret and redirect URI.",
    )
  })

  it("prefers the server message when no known callback error is present", () => {
    expect(
      resolveAuthCallbackErrorMessage(
        "callback_error",
        "The OAuth callback could not be completed.",
        "Unable to continue with Google.",
      ),
    ).toBe("The OAuth callback could not be completed.")
  })

  it("falls back when no message is available", () => {
    expect(
      resolveAuthCallbackErrorMessage(null, null, "Unable to continue with Google."),
    ).toBe("Unable to continue with Google.")
  })
})