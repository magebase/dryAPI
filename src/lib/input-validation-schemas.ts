import { z } from "zod"

function formatUsdAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const chatMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string().trim().min(1),
})

export const chatContactCaptureSchema = z
  .object({
    email: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide an email or phone for chat contact capture.",
      })
    }

    if (value.email && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contact capture email must be valid.",
        path: ["email"],
      })
    }

    if (value.phone) {
      const digitsOnly = value.phone.replace(/\D/g, "")
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contact capture phone must include 8-15 digits.",
          path: ["phone"],
        })
      }
    }
  })

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).optional().default([]),
    pagePath: z.string().trim().default("/"),
    visitorId: z.string().trim().default("anonymous"),
    allowEscalation: z.boolean().optional().default(true),
    turnstileToken: z.string().trim().optional().default(""),
    contactCapture: chatContactCaptureSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.contactCapture && value.messages.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No user message provided.",
        path: ["messages"],
      })
    }
  })

export const playgroundGenerateSchema = z
  .object({
    apiKeyId: z.string().trim().min(1),
    model: z.string().trim().optional(),
    prompt: z.string().trim().min(1),
    n: z.number().int().positive().max(8).optional().default(1),
    size: z.string().trim().optional().default("1024x1024"),
    expectedRpm: z.number().positive().optional(),
    allowLowMarginOverride: z.boolean().optional().default(false),
  })
  .passthrough()

export function createBillingTopUpAmountSchema(minCredits: number) {
  return z.number().finite().min(minCredits, `Amount must be at least ${formatUsdAmount(minCredits)}.`)
}

export function createAutoTopUpSettingsSchema(minCredits: number) {
  const amountSchema = createBillingTopUpAmountSchema(minCredits)

  return z.object({
    enabled: z.boolean(),
    thresholdCredits: z.number().finite().min(0),
    amountCredits: amountSchema,
    monthlyCapCredits: amountSchema,
  })
}

export const twoFactorPasswordSchema = z.string().trim().min(1, "Enter your password to continue.")

export const twoFactorVerificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.")

export const crmMailingListSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().optional().default(""),
  lastName: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  tags: z.array(z.string().trim()).optional().default([]),
})

export const crmWorkflowDispatchSchema = z.object({
  kind: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
})