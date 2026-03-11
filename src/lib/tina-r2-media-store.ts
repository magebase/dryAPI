type TinaMedia = {
  id: string
  type: "file"
  filename: string
  directory?: string
  src: string
  thumbnails?: Record<string, string>
}

const api = {
  upload: "/api/media/upload",
  list: "/api/media/list",
  remove: "/api/media/delete",
}

export class TinaR2MediaStore {
  accept = "image/*,video/*"

  async persist(media: { file: File }): Promise<TinaMedia> {
    const body = new FormData()
    body.append("file", media.file)

    const response = await fetch(api.upload, {
      method: "POST",
      body,
    })

    if (!response.ok) {
      throw new Error("Failed to upload media to Cloudflare R2")
    }

    return (await response.json()) as TinaMedia
  }

  async list(): Promise<{ items: TinaMedia[]; nextOffset: number | null }> {
    const response = await fetch(api.list)

    if (!response.ok) {
      throw new Error("Failed to list media from Cloudflare R2")
    }

    const items = (await response.json()) as TinaMedia[]

    return {
      items,
      nextOffset: null,
    }
  }

  async delete(media: TinaMedia): Promise<void> {
    await fetch(api.remove, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: media.id }),
    })
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
