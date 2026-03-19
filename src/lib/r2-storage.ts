import "server-only"

import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

type UploadedFile = {
  key: string
  url: string
}

const MEDIA_KEY_PREFIX = "media/"

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

export async function uploadFileToR2(file: File): Promise<UploadedFile | null> {
  const context = getClient()

  if (!context) {
    return null
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin"
  const timestamp = Date.now()
  const random = Math.random().toString(16).slice(2)
  const key = `media/${timestamp}-${random}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())

  await context.client.send(
    new PutObjectCommand({
      Bucket: context.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  )

  return {
    key,
    url: `${context.config.publicUrl.replace(/\/$/, "")}/${key}`,
  }
}

export async function listR2Files() {
  const context = getClient()

  if (!context) {
    return []
  }

  const result = await context.client.send(
    new ListObjectsV2Command({
      Bucket: context.config.bucket,
      Prefix: "media/",
      MaxKeys: 200,
    })
  )

  return (result.Contents || [])
    .filter((item) => item.Key)
    .map((item) => ({
      key: item.Key as string,
      url: `${context.config.publicUrl.replace(/\/$/, "")}/${item.Key}`,
    }))
}

export function isDeletableMediaKey(key: string): boolean {
  return key.startsWith(MEDIA_KEY_PREFIX) && !key.includes("..") && !key.includes("\\")
}

export async function deleteR2File(key: string) {
  if (!isDeletableMediaKey(key)) {
    return false
  }

  const context = getClient()

  if (!context) {
    return false
  }

  await context.client.send(
    new DeleteObjectCommand({
      Bucket: context.config.bucket,
      Key: key,
    })
  )

  return true
}
