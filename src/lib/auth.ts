import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"

type SocialProviderConfig = {
  clientId: string
  clientSecret: string
}

function readSocialProviders(): Record<string, SocialProviderConfig> | undefined {
  const providers: Record<string, SocialProviderConfig> = {}

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }
  }

  return Object.keys(providers).length > 0 ? providers : undefined
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: readSocialProviders(),
  plugins: [nextCookies()],
})
