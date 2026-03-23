import "server-only"

import { createHash, createHmac } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"

const ACCOUNT_EXPORT_REQUEST_AUDIENCE = "account-export"
const ACCOUNT_EXPORT_DOWNLOAD_AUDIENCE = "account-export-download"
const ACCOUNT_EXPORT_REQUEST_TTL_SECONDS = 60 * 60 * 24
const ACCOUNT_EXPORT_DOWNLOAD_TTL_SECONDS = 60 * 15

type AccountExportRequestTokenPayload = {
  requestId: string
  userEmail: string
  zipKey: string
  otpHash: string
  zipFileName: string
}

type AccountExportDownloadTokenPayload = {
  requestId: string
  userEmail: string
  zipKey: string
  zipFileName: string
}

function resolveAccountExportSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for account export tokens.")
  }

  return secret
}

async function signAccountExportToken(
  payload: Record<string, string>,
  audience: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userEmail.trim().toLowerCase())
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(new TextEncoder().encode(resolveAccountExportSecret()))
}

async function verifyAccountExportToken<TPayload extends Record<string, string>>(
  token: string,
  audience: string,
  validate: (payload: Record<string, unknown>) => TPayload,
): Promise<TPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(resolveAccountExportSecret()), {
    audience,
  })

  return validate(payload as Record<string, unknown>)
}

export function deriveAccountExportOtp({ requestId, userEmail }: { requestId: string; userEmail: string }): string {
  const digest = createHmac("sha256", resolveAccountExportSecret())
    .update(`${requestId}:${userEmail.trim().toLowerCase()}`)
    .digest("hex")

  const numeric = Number.parseInt(digest.slice(0, 10), 16) % 1_000_000
  return numeric.toString().padStart(6, "0")
}

export function hashAccountExportOtp(otp: string, requestId: string): string {
  return createHash("sha256")
    .update(`${resolveAccountExportSecret()}:${requestId}:${otp}`)
    .digest("hex")
}

export async function signAccountExportRequestToken(payload: AccountExportRequestTokenPayload): Promise<string> {
  return signAccountExportToken(
    {
      requestId: payload.requestId,
      zipKey: payload.zipKey,
      otpHash: payload.otpHash,
      zipFileName: payload.zipFileName,
      userEmail: payload.userEmail.trim().toLowerCase(),
    },
    ACCOUNT_EXPORT_REQUEST_AUDIENCE,
    ACCOUNT_EXPORT_REQUEST_TTL_SECONDS,
  )
}

export async function verifyAccountExportRequestToken(token: string): Promise<AccountExportRequestTokenPayload> {
  return verifyAccountExportToken(token, ACCOUNT_EXPORT_REQUEST_AUDIENCE, (payload) => {
    const requestId = typeof payload.requestId === "string" ? payload.requestId : ""
    const zipKey = typeof payload.zipKey === "string" ? payload.zipKey : ""
    const otpHash = typeof payload.otpHash === "string" ? payload.otpHash : ""
    const zipFileName = typeof payload.zipFileName === "string" ? payload.zipFileName : ""
    const userEmail = typeof payload.sub === "string" ? payload.sub : ""

    if (!requestId || !zipKey || !otpHash || !zipFileName || !userEmail) {
      throw new Error("Invalid account export token payload.")
    }

    return {
      requestId,
      userEmail,
      zipKey,
      otpHash,
      zipFileName,
    }
  })
}

export async function signAccountExportDownloadToken(
  payload: AccountExportDownloadTokenPayload,
): Promise<string> {
  return signAccountExportToken(
    {
      requestId: payload.requestId,
      zipKey: payload.zipKey,
      zipFileName: payload.zipFileName,
      userEmail: payload.userEmail.trim().toLowerCase(),
    },
    ACCOUNT_EXPORT_DOWNLOAD_AUDIENCE,
    ACCOUNT_EXPORT_DOWNLOAD_TTL_SECONDS,
  )
}

export async function verifyAccountExportDownloadToken(
  token: string,
): Promise<AccountExportDownloadTokenPayload> {
  return verifyAccountExportToken(token, ACCOUNT_EXPORT_DOWNLOAD_AUDIENCE, (payload) => {
    const requestId = typeof payload.requestId === "string" ? payload.requestId : ""
    const zipKey = typeof payload.zipKey === "string" ? payload.zipKey : ""
    const zipFileName = typeof payload.zipFileName === "string" ? payload.zipFileName : ""
    const userEmail = typeof payload.sub === "string" ? payload.sub : ""

    if (!requestId || !zipKey || !zipFileName || !userEmail) {
      throw new Error("Invalid account export download token payload.")
    }

    return {
      requestId,
      userEmail,
      zipKey,
      zipFileName,
    }
  })
}

export function buildAccountExportDownloadUrl(downloadToken: string): string {
  return `/api/dashboard/settings/account/export/download?downloadToken=${encodeURIComponent(downloadToken)}`
}