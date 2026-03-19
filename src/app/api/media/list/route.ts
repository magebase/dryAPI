import { NextResponse } from "next/server";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import { listR2Files } from "@/lib/r2-storage";

export async function GET(request: Request) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const files = await listR2Files();

  return NextResponse.json(
    files.map((file) => ({
      id: file.key,
      type: "file",
      filename: file.key.split("/").pop() || file.key,
      directory: "",
      src: file.url,
      thumbnails: {
        "75x75": file.url,
        "400x400": file.url,
        "1000x1000": file.url,
      },
    })),
  );
}
