import { NextResponse } from "next/server";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import { deleteR2File, isDeletableMediaKey } from "@/lib/r2-storage";

export async function POST(request: Request) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = (await request.json()) as { id?: string };
  const mediaId = typeof payload.id === "string" ? payload.id.trim() : "";

  if (!mediaId) {
    return NextResponse.json({ error: "Missing media id" }, { status: 400 });
  }

  if (!isDeletableMediaKey(mediaId)) {
    return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
  }

  try {
    await deleteR2File(mediaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete media from Cloudflare R2.",
      },
      { status: 500 },
    );
  }
}
