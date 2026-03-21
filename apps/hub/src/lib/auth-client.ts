import { createAuthClient } from "better-auth/react"
import { apiKeyClient } from "@better-auth/api-key/client"
import { adminClient } from "better-auth/client/plugins"

const authPlugins = [adminClient(), apiKeyClient()] as any

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3001"),
  plugins: authPlugins,
})

export type { Session, User } from "./auth"
