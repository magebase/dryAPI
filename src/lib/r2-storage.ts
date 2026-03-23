import "server-only"

import { randomUUID } from "node:crypto"

import { getCloudflareContext } from "@opennextjs/cloudflare"

type UploadedFile = {
  key: string
  url: string
  directory: string
}

type R2ObjectBodyLike = {
  body: ReadableStream
  size: number
  httpMetadata?: {
    contentType?: string
  }
}

type R2BucketLike = {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string
      }
      customMetadata?: Record<string, string>
    },
  ) => Promise<unknown>
  get: (key: string) => Promise<R2ObjectBodyLike | null>
  delete: (keys: string | string[]) => Promise<void>
  list: (options?: {
    limit?: number
    prefix?: string
  }) => Promise<{
    objects: Array<{
      key: string
    }>
  }>
}

const MEDIA_KEY_PREFIX = "media/"
const MEDIA_BUCKET_BINDING = "MEDIA_R2_BUCKET"
const ACCOUNT_EXPORTS_BUCKET_BINDING = "ACCOUNT_EXPORTS_R2_BUCKET"

function resolvePublicMediaUrl(): string {
  const publicUrl = process.env.R2_PUBLIC_URL?.trim()

  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL is required for media URLs.")
  }

  return publicUrl.replace(/\/$/, "")
}

async function resolveR2Bucket(
  bindingName: typeof MEDIA_BUCKET_BINDING | typeof ACCOUNT_EXPORTS_BUCKET_BINDING,
): Promise<R2BucketLike> {
  const { env } = await getCloudflareContext({ async: true })
  const bucket = (env as Record<string, unknown>)[bindingName]

  if (!bucket || typeof bucket !== "object") {
    throw new Error(`${bindingName} binding is required.`)
  }

  return bucket as R2BucketLike
}

function buildMediaUrl(key: string): string {
  return `${resolvePublicMediaUrl()}/${key}`
}

export async function uploadFileToR2(file: File): Promise<UploadedFile> {
  return uploadFileToR2WithOptions(file, { directory: "" })
}

type UploadFileOptions = {
  directory?: string
}

function normalizeDirectory(directory: string | undefined): string {
  const trimmed = (directory || "").trim()
  if (!trimmed) {
    return ""
  }

  const segments = trimmed
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return ""
  }

  for (const segment of segments) {
    if (segment === "." || segment === ".." || segment.includes("\\")) {
      throw new Error("Invalid media directory.")
    }
  }

  return segments.join("/")
}

export async function uploadFileToR2WithOptions(file: File, options: UploadFileOptions): Promise<UploadedFile> {
  const directory = normalizeDirectory(options.directory)

  const extension = file.name.includes(".")
    ? file.name.split(".").pop() || "bin"
    : "bin"
  const timestamp = Date.now()
  const random = randomUUID()
  const keySuffix = `${timestamp}-${random}.${extension}`
  const key = directory ? `media/${directory}/${keySuffix}` : `media/${keySuffix}`

  const bucket = await resolveR2Bucket(MEDIA_BUCKET_BINDING)

  await bucket.put(key, file, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  })

  return {
    key,
    url: buildMediaUrl(key),
    directory,
  }
}

export async function listR2Files() {
  const bucket = await resolveR2Bucket(MEDIA_BUCKET_BINDING)
  const result = await bucket.list({
    prefix: MEDIA_KEY_PREFIX,
    limit: 200,
  })

  return result.objects.map((item) => ({
    key: item.key,
    url: buildMediaUrl(item.key),
  }))
}

export function isDeletableMediaKey(key: string): boolean {
  return key.startsWith(MEDIA_KEY_PREFIX) && !key.includes("..") && !key.includes("\\")
}

export async function deleteR2File(key: string) {
  if (!isDeletableMediaKey(key)) {
    throw new Error("Invalid media id.")
  }

  const bucket = await resolveR2Bucket(MEDIA_BUCKET_BINDING)
  await bucket.delete(key)
}

export async function putPrivateObjectToR2(options: {
  key: string
  body: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string | null
  contentType?: string
}): Promise<void> {
  const bucket = await resolveR2Bucket(ACCOUNT_EXPORTS_BUCKET_BINDING)

  await bucket.put(options.key, options.body, {
    ...(options.contentType
      ? {
          httpMetadata: {
            contentType: options.contentType,
          },
        }
      : {}),
  })
}

export async function readPrivateObjectFromR2(key: string): Promise<R2ObjectBodyLike | null> {
  const bucket = await resolveR2Bucket(ACCOUNT_EXPORTS_BUCKET_BINDING)
  return bucket.get(key)
}
