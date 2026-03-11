import type { UploadPresignRequest } from "@/lib/upload-presign-schema"

type UploadPresignResponse = {
  ok: boolean
  uploadUrl?: string
  publicUrl?: string
  key?: string
  error?: string
}

export async function requestPresignedUpload(payload: UploadPresignRequest) {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as UploadPresignResponse

  if (!response.ok || !body.ok || !body.uploadUrl || !body.publicUrl || !body.key) {
    throw new Error(body.error || "Unable to create upload URL.")
  }

  return {
    uploadUrl: body.uploadUrl,
    publicUrl: body.publicUrl,
    key: body.key,
  }
}

export async function uploadFileToR2Direct(file: File) {
  const presigned = await requestPresignedUpload({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  })

  const response = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error("Direct upload failed.")
  }

  return presigned
}
