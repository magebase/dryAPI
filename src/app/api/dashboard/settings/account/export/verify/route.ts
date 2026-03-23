import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildAccountExportDownloadUrl,
  hashAccountExportOtp,
  signAccountExportDownloadToken,
  verifyAccountExportRequestToken,
} from "@/lib/account-export-tokens";

const accountExportVerifySchema = z.object({
  token: z.string().min(1),
  otp: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: NextRequest) {
  const parsed = accountExportVerifySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "A valid export token and 6-digit OTP are required.",
      },
      { status: 400 },
    );
  }

  try {
    const requestToken = await verifyAccountExportRequestToken(parsed.data.token);

    if (hashAccountExportOtp(parsed.data.otp, requestToken.requestId) !== requestToken.otpHash) {
      throw new Error("Invalid account export OTP.");
    }

    const downloadToken = await signAccountExportDownloadToken({
      requestId: requestToken.requestId,
      userEmail: requestToken.userEmail,
      zipKey: requestToken.zipKey,
      zipFileName: requestToken.zipFileName,
    });

    return NextResponse.json({
      ok: true,
      downloadUrl: buildAccountExportDownloadUrl(downloadToken),
      zipFileName: requestToken.zipFileName,
      userEmail: requestToken.userEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "export_verification_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 403 },
    );
  }
}