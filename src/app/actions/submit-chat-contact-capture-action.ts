"use server"

import { headers } from "next/headers"

import { chatRequestSchema } from "@/lib/input-validation-schemas"
import { actionClient } from "@/lib/safe-action"

type ChatApiResponse = {
  ok: boolean
  answer?: string
  error?: string
  escalated?: boolean
}

export const submitChatContactCaptureAction = actionClient
  .inputSchema(chatRequestSchema)
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
