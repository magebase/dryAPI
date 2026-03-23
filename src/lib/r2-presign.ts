import "server-only"

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { UploadPresignRequest } from "@/lib/upload-presign-schema"

const PRESIGNED_URL_EXPIRY_SECONDS = 60 * 5

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID
  const bucket = process.env.R2_BUCKET
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    return null
  }

  return {
    bucket,
    publicUrl,
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  }
}

function getClient() {
  const config = getR2Config()

  if (!config) {
    return null
  }

  return {
    config,
    client: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: config.credentials,
    }),
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function createR2PresignedUpload(request: UploadPresignRequest) {
  const context = getClient()

  if (!context) {
    return null
  }

  const key = `uploads/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(request.filename)}`

  const command = new PutObjectCommand({
    Bucket: context.config.bucket,
    Key: key,
    ContentType: request.contentType,
    ContentLength: request.size,
  })

  const uploadUrl = await getSignedUrl(context.client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  })

  return {
    key,
    uploadUrl,
    publicUrl: `${context.config.publicUrl.replace(/\/$/, "")}/${key}`,
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  }
}

export async function createR2SignedDownloadUrl(key: string): Promise<string | null> {
  const context = getClient()

  if (!context) {
    return null
  }

  const command = new GetObjectCommand({
    Bucket: context.config.bucket,
    Key: key,
  })

  return getSignedUrl(context.client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  })
}
