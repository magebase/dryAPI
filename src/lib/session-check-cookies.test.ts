import {
  buildSessionCheckCookieHeader,
  SESSION_CHECK_COOKIE_NAMES,
} from "@/lib/session-check-cookies"

describe("buildSessionCheckCookieHeader", () => {
  it("returns only Better Auth cookies in configured order", () => {
    const cookieMap: Record<string, string | undefined> = {
      "unrelated": "ignore-me",
      "better-auth.session_data": "session-data",
      "__Secure-better-auth.session_token": "secure-token",
      "better-auth.session_token": "token",
      "better-auth.account_data": "account-data",
    }

    const header = buildSessionCheckCookieHeader((cookieName) => cookieMap[cookieName])

    const expectedNames = SESSION_CHECK_COOKIE_NAMES.filter((cookieName) =>
      Boolean(cookieMap[cookieName]),
    )

    expect(header).toBe(
      expectedNames
        .map((cookieName) => `${cookieName}=${cookieMap[cookieName]}`)
        .join("; "),
    )
  })

  it("omits blank and missing values", () => {
    const cookieMap: Record<string, string | undefined> = {
      "better-auth.session_token": " ",
      "__Secure-better-auth.session_token": "secure-token",
      "better-auth.session_data": "",
    }

    const header = buildSessionCheckCookieHeader((cookieName) => cookieMap[cookieName])

    expect(header).toBe("__Secure-better-auth.session_token=secure-token")
  })

  it("returns an empty string when no Better Auth cookies are available", () => {
    const header = buildSessionCheckCookieHeader(() => undefined)

    expect(header).toBe("")
  })
})
