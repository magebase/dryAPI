import { NextResponse } from "next/server";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import { uploadFileToR2WithOptions } from "@/lib/r2-storage";

export async function POST(request: Request) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await request.formData();
  const file = data.get("file");
  const directory = data.get("directory");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const uploaded = await uploadFileToR2WithOptions(file, {
      directory: typeof directory === "string" ? directory : "",
    });
    return NextResponse.json({
      id: uploaded.key,
      type: "file",
      filename: file.name,
      directory: uploaded.directory,
      src: uploaded.url,
      thumbnails: {
        "75x75": uploaded.url,
        "400x400": uploaded.url,
        "1000x1000": uploaded.url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload media to Cloudflare R2."
    const status = message === "Invalid media directory." ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
