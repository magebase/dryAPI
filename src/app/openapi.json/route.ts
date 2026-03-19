import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "docs",
    "deapi-mirror",
    "articles",
    "openapi.hono.json",
  );
  const content = await readFile(filePath, "utf8");

  return new Response(content, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
