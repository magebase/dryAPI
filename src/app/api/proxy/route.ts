import { openapi } from "@/lib/openapi"

const allowedOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((value): value is string => Boolean(value))

export const { GET, HEAD, PUT, POST, PATCH, DELETE } = openapi.createProxy({
  allowedOrigins,
})
