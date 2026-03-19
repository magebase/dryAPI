import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import { createR2PresignedUpload } from "@/lib/r2-presign";
import { uploadPresignRequestSchema } from "@/lib/upload-presign-schema";

export async function POST(request: Request) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const parsed = uploadPresignRequestSchema.parse(payload);
    const presigned = await createR2PresignedUpload(parsed);

    if (!presigned) {
      return NextResponse.json(
        {
          ok: false,
          error: "R2 upload signing is not configured.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...presigned,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, errors: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to create upload URL." },
      { status: 500 },
    );
  }
}
