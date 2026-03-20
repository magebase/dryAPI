type TinaMedia = {
  id: string
  type: "file"
  filename: string
  directory?: string
  src: string
  thumbnails?: Record<string, string>
}

const api = {
  upload: "/admin/api/media/upload",
  list: "/admin/api/media/list",
  remove: "/admin/api/media/delete",
}

type TinaMediaLike = Partial<TinaMedia> & {
  media?: Partial<TinaMedia>
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function extractString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function normalizeMediaPayload(value: unknown): TinaMedia {
  if (!isObjectRecord(value)) {
    throw new Error("Invalid Tina media payload.")
  }

  const raw = (value as TinaMediaLike).media && isObjectRecord((value as TinaMediaLike).media)
    ? ((value as TinaMediaLike).media as TinaMediaLike)
    : (value as TinaMediaLike)

  const id = extractString(raw.id)
  const src = extractString(raw.src)

  if (!id || !src) {
    throw new Error("Invalid Tina media payload.")
  }

  const filename = extractString(raw.filename) ?? src.split("/").pop() ?? id
  const directory = extractString(raw.directory) ?? ""

  return {
    id,
    type: "file",
    filename,
    directory,
    src,
    thumbnails: isObjectRecord(raw.thumbnails) ? (raw.thumbnails as Record<string, string>) : undefined,
  }
}

export class TinaR2MediaStore {
  accept = "image/*,video/*"

  async persist(media: { file?: File; directory?: string }): Promise<TinaMedia> {
    if (!(media.file instanceof File)) {
      throw new Error("Tina media persistence requires media.file to be a File instance.")
    }

    const body = new FormData()
    body.append("file", media.file)

    if (typeof media.directory === "string" && media.directory.trim().length > 0) {
      body.append("directory", media.directory)
    }

    const response = await fetch(api.upload, {
      method: "POST",
      body,
    })

    if (!response.ok) {
      throw new Error("Failed to upload media to Cloudflare R2")
    }

    return normalizeMediaPayload(await response.json())
  }

  async list(): Promise<{ items: TinaMedia[]; nextOffset: number | null }> {
    const response = await fetch(api.list)

    if (!response.ok) {
      throw new Error("Failed to list media from Cloudflare R2")
    }

    const payload = await response.json()
    const rawItems = Array.isArray(payload)
      ? payload
      : isObjectRecord(payload) && Array.isArray(payload.items)
        ? payload.items
        : []
    const items = rawItems.map((item) => normalizeMediaPayload(item))

    return {
      items,
      nextOffset: null,
    }
  }

  async delete(media: TinaMedia): Promise<void> {
    const response = await fetch(api.remove, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: media.id }),
    })

    if (!response.ok) {
      throw new Error("Failed to delete media from Cloudflare R2")
    }
  }

  previewSrc(src: string) {
    const params = new URLSearchParams({
      url: src,
      w: "1200",
      q: "75",
    })

    return `/_next/image?${params.toString()}`
  }
}

export const tinaR2MediaStore = new TinaR2MediaStore()
