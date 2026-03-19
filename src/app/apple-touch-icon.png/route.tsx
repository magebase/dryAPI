export async function GET(request: Request) {
  const faviconResponse = await fetch(new URL("/favicon.ico", request.url));
  const icon = await faviconResponse.arrayBuffer();

  return new Response(icon, {
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
