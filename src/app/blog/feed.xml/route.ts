import { generateBlogFeedFormats } from "@/lib/blog-feed";

export async function GET() {
  const feeds = await generateBlogFeedFormats();

  if (!feeds) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(feeds.rss2, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
