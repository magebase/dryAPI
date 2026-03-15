import { generateBlogFeedFormats } from "@/lib/blog-feed"

export const runtime = "nodejs"
export const dynamic = "force-static"

export async function GET() {
  const feeds = await generateBlogFeedFormats()

  if (!feeds) {
    return new Response("Not Found", { status: 404 })
  }

  return new Response(feeds.atom1, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  })
}
