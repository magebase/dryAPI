"use server"

import { headers } from "next/headers"
import { z } from "zod"

import { actionClient } from "@/lib/safe-action"

const actionSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["assistant", "user"]),
      content: z.string().trim().min(1),
    })
  ),
  pagePath: z.string().trim().default("/"),
  visitorId: z.string().trim().default("anonymous"),
  allowEscalation: z.boolean().default(true),
  contactCapture: z.object({
    email: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
  }),
})

type ChatApiResponse = {
  ok: boolean
  answer?: string
  error?: string
  escalated?: boolean
}

export const submitChatContactCaptureAction = actionClient
  .inputSchema(actionSchema)
  .action(async ({ parsedInput }) => {
    const headerStore = await headers()
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host")
    const proto =
      headerStore.get("x-forwarded-proto") || (process.env.NODE_ENV === "development" ? "http" : "https")

    if (!host) {
      throw new Error("Unable to resolve host for chat submission.")
    }

    const response = await fetch(`${proto}://${host}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput),
      cache: "no-store",
    })

    const body = (await response.json()) as ChatApiResponse

    if (!response.ok || !body.ok) {
      throw new Error(body.error || "Unable to send contact details right now.")
    }

    return body
  })
