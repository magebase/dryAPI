import { afterEach, describe, expect, it, vi } from "vitest"

import { TinaR2MediaStore } from "@/lib/tina-r2-media-store"

describe("TinaR2MediaStore", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("uploads multipart payloads and keeps directory values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          media: {
            id: "media/gallery/image.png",
            filename: "image.png",
            directory: "gallery",
            src: "https://cdn.example/media/gallery/image.png",
          },
        }),
        { status: 200 }
      )
    )

    global.fetch = fetchMock as typeof fetch

    const store = new TinaR2MediaStore()
    const media = await store.persist({
      file: new File(["hello"], "image.png", { type: "image/png" }),
      directory: "gallery",
    })

    expect(media).toEqual({
      id: "media/gallery/image.png",
      type: "file",
      filename: "image.png",
      directory: "gallery",
      src: "https://cdn.example/media/gallery/image.png",
      thumbnails: undefined,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/admin/api/media/upload")
    expect(init.method).toBe("POST")
    expect(init.body).toBeInstanceOf(FormData)

    const formData = init.body as FormData
    expect(formData.get("directory")).toBe("gallery")
    expect(formData.get("file")).toBeInstanceOf(File)
  })

  it("rejects persist calls when media.file is not a File", async () => {
    const store = new TinaR2MediaStore()

    await expect(
      store.persist({
        file: undefined,
      })
    ).rejects.toThrow("Tina media persistence requires media.file to be a File instance.")
  })

  it("normalizes list payloads", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "media/one.png",
              filename: "one.png",
              directory: "",
              src: "https://cdn.example/media/one.png",
            },
          ],
        }),
        { status: 200 }
      )
    ) as typeof fetch

    const store = new TinaR2MediaStore()
    const listed = await store.list()

    expect(listed).toEqual({
      items: [
        {
          id: "media/one.png",
          type: "file",
          filename: "one.png",
          directory: "",
          src: "https://cdn.example/media/one.png",
          thumbnails: undefined,
        },
      ],
      nextOffset: null,
    })
  })

  it("throws when delete fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("fail", { status: 500 })) as typeof fetch

    const store = new TinaR2MediaStore()

    await expect(
      store.delete({
        id: "media/one.png",
        type: "file",
        filename: "one.png",
        src: "https://cdn.example/media/one.png",
      })
    ).rejects.toThrow("Failed to delete media from Cloudflare R2")
  })
})
