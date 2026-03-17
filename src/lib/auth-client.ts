"use client"

import { apiKeyClient } from "@better-auth/api-key/client"
import { i18nClient } from "@better-auth/i18n/client"
import { stripeClient } from "@better-auth/stripe/client"
import { createAuthClient } from "better-auth/react"
import {
  adminClient,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    adminClient(),
    i18nClient(),
    lastLoginMethodClient(),
    organizationClient(),
    stripeClient(),
    twoFactorClient(),
  ],
})