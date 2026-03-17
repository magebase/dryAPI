import "server-only"

import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    STRIPE_PRIVATE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_METER_BILLING_CUSTOMER_ID: z.string().optional(),
    STRIPE_METER_PROJECT_KEY: z.string().optional(),
    STRIPE_METER_EVENT_AI_MODEL_CALL: z.string().optional(),
    STRIPE_METER_EVENT_MODERATION_MODEL_CALL: z.string().optional(),
    STRIPE_METER_EVENT_BREVO_SMS_SEND: z.string().optional(),
    STRIPE_METER_EVENT_CAL_REQUEST: z.string().optional(),
    STRIPE_METER_EVENT_CLOUDFLARE_WORKER_REQUEST: z.string().optional(),
    STRIPE_METER_EVENT_WORKFLOW_DISPATCH: z.string().optional(),
    STRIPE_METER_EVENT_WORKFLOW_RUN: z.string().optional(),
    STRIPE_SAAS_PRICE_STARTER: z.string().optional(),
    STRIPE_SAAS_PRICE_GROWTH: z.string().optional(),
    STRIPE_SAAS_PRICE_SCALE: z.string().optional(),
    STRIPE_SAAS_ANNUAL_PRICE_STARTER: z.string().optional(),
    STRIPE_SAAS_ANNUAL_PRICE_GROWTH: z.string().optional(),
    STRIPE_SAAS_ANNUAL_PRICE_SCALE: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {},
})
