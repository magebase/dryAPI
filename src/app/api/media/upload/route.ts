import { NextResponse } from "next/server";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import { uploadFileToR2 } from "@/lib/r2-storage";

export async function POST(request: Request) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await request.formData();
  const file = data.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const uploaded = await uploadFileToR2(file);

  if (!uploaded) {
    return NextResponse.json(
      {
        error:
          "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: uploaded.key,
    type: "file",
    filename: file.name,
    directory: "",
    src: uploaded.url,
    thumbnails: {
      "75x75": uploaded.url,
      "400x400": uploaded.url,
      "1000x1000": uploaded.url,
    },
  });
}
