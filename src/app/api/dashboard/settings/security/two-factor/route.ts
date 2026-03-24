import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing"
import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"

const { getSqlDbAsync } = createCloudflareDbAccessors(HYPERDRIVE_BINDING_PRIORITY, {})

const twoFactorEmailOtpSchema = z.object({
  action: z.enum(["enable", "disable"]),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
})

type VerificationResponse =
  | { success?: boolean; message?: string; error?: string }
  | null

function buildErrorResponse(status: number, error: string, message: string): NextResponse {
  return NextResponse.json(
    {
      error,
      message,
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}

async function verifyEmailOtp(request: NextRequest, email: string, otp: string): Promise<void> {
  const verificationResponse = await fetch(
    new URL("/api/auth/email-otp/check-verification-otp", request.url),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        email,
        type: "email-verification",
        otp,
      }),
    },
  )

  if (verificationResponse.ok) {
    return
  }

  const payload = (await verificationResponse.json().catch(() => null)) as VerificationResponse
  const message = payload?.message?.trim() || payload?.error?.trim() || "Enter the code sent to your email."

  throw new Error(message)
}

async function resolveUserId(email: string): Promise<string | null> {
  const db = await getSqlDbAsync()
  const response = await db
    .prepare(
      `
      SELECT id
      FROM user
      WHERE lower(email) = ?
      LIMIT 1
      `,
    )
    .bind(email)
    .all<{ id: string }>()

  return response.results[0]?.id ?? null
}

async function updateTwoFactorFlag(userId: string, enabled: boolean): Promise<void> {
  const db = await getSqlDbAsync()

  await db
    .prepare(
      `
      UPDATE user
      SET twoFactorEnabled = ?
      WHERE id = ?
      `,
    )
    .bind(enabled, userId)
    .run()

  await db
    .prepare(
      `
      DELETE FROM twoFactor
      WHERE userId = ?
      `,
    )
    .bind(userId)
    .run()
}

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)

  if (!session.authenticated || !session.email) {
    return buildErrorResponse(401, "unauthorized", "Sign in to update account protection.")
  }

  const parsed = twoFactorEmailOtpSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return buildErrorResponse(
      400,
      "invalid_request",
      "A valid action and 6-digit email code are required.",
    )
  }

  const email = session.email.trim().toLowerCase()

  try {
    await verifyEmailOtp(request, email, parsed.data.otp)

    const userId = await resolveUserId(email)
    if (!userId) {
      return buildErrorResponse(404, "account_not_found", "Unable to resolve the current account.")
    }

    const enabled = parsed.data.action === "enable"
    await updateTwoFactorFlag(userId, enabled)

    return NextResponse.json(
      {
        ok: true,
        twoFactorEnabled: enabled,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    )
  } catch (error) {
    return buildErrorResponse(
      403,
      "verification_failed",
      error instanceof Error ? error.message : "Unable to verify the email code.",
    )
  }
}
