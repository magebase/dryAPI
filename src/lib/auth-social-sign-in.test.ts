import { describe, expect, it } from "vitest"

import { buildSocialSignInRequestBody } from "@/lib/auth-social-sign-in"

describe("buildSocialSignInRequestBody", () => {
  it("always disables redirects and keeps callback fields intact", () => {
    expect(
      buildSocialSignInRequestBody({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      }),
    ).toEqual({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
      disableRedirect: true,
    })
  })

  it("preserves sign-up specific fields", () => {
    expect(
      buildSocialSignInRequestBody({
        provider: "google",
        callbackURL: "/dashboard",
        newUserCallbackURL: "/dashboard",
        errorCallbackURL: "/register",
        requestSignUp: true,
      }),
    ).toEqual({
      provider: "google",
      callbackURL: "/dashboard",
      newUserCallbackURL: "/dashboard",
      errorCallbackURL: "/register",
      requestSignUp: true,
      disableRedirect: true,
    })
  })
})
