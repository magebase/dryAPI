import type { NextRequest } from "next/server"

type TurnstileVerifySuccess = {
  ok: true
  skipped?: boolean
}

type TurnstileVerifyFailure = {
  ok: false
  error: string
  codes?: string[]
}

export type TurnstileVerifyResult = TurnstileVerifySuccess | TurnstileVerifyFailure

type TurnstileVerifyResponse = {
  success: boolean
  "error-codes"?: string[]
  action?: string
}

function getTurnstileSecret() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || ""
}

export function getRequestIp(request: NextRequest): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  const xForwardedFor = request.headers.get("x-forwarded-for")?.trim()
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }

  const xRealIp = request.headers.get("x-real-ip")?.trim()
  if (xRealIp) {
    return xRealIp
  }

  return ""
}

export async function verifyTurnstileToken({
  token,
  action,
  remoteIp,
}: {
  token: string
  action: string
  remoteIp?: string
}): Promise<TurnstileVerifyResult> {
  const secret = getTurnstileSecret()

  if (!secret) {
    return {
      ok: true,
      skipped: true,
    }
  }

  const challengeToken = token.trim()
  if (!challengeToken) {
    return {
      ok: false,
      error: "Missing Turnstile token",
      codes: ["missing-input-response"],
    }
  }

  const payload = new URLSearchParams()
  payload.set("secret", secret)
  payload.set("response", challengeToken)
  if (remoteIp) {
    payload.set("remoteip", remoteIp)
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  })

  if (!response.ok) {
    return {
      ok: false,
      error: `Turnstile verification request failed (${response.status})`,
    }
  }

  const body = (await response.json()) as TurnstileVerifyResponse

  if (!body.success) {
    return {
      ok: false,
      error: "Turnstile challenge failed",
      codes: body["error-codes"] || [],
    }
  }

  if (body.action && body.action !== action) {
    return {
      ok: false,
      error: `Turnstile action mismatch: expected ${action}, received ${body.action}`,
      codes: ["action-mismatch"],
    }
  }

  return {
    ok: true,
  }
}
