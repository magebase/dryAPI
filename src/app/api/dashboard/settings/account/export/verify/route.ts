import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveAccountExportDownloadUrl } from "@/lib/account-export";

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
    const result = await resolveAccountExportDownloadUrl(parsed.data.token, parsed.data.otp);

    return NextResponse.json({
      ok: true,
      downloadUrl: result.downloadUrl,
      zipFileName: result.zipFileName,
      userEmail: result.userEmail,
    })
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