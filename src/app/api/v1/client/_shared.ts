import { NextRequest, NextResponse } from "next/server"

import { resolveConfiguredBalance } from "@/lib/configured-balance"

const BEARER_TOKEN_ENV_KEYS = ["DASHBOARD_API_KEY", "DEAPI_API_KEY", "API_KEY", "INTERNAL_API_KEY"] as const

function resolveExpectedBearerToken(): string | null {
  for (const key of BEARER_TOKEN_ENV_KEYS) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return null
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim()
  return token || null
}

export function requireApiTokenIfConfigured(request: NextRequest): NextResponse | null {
  const expected = resolveExpectedBearerToken()
  if (!expected) {
    return null
  }

  const token = getBearerToken(request)
  if (token === expected) {
    return null
  }

  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message: "Missing or invalid bearer token.",
      },
    },
    { status: 401 }
  )
}

export function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.min(parsed, max)
}

export function parseInferenceTypeFilter(searchParams: URLSearchParams): Set<string> {
  const values = searchParams
    .getAll("filter[inference_types]")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)

  return new Set(values)
}
