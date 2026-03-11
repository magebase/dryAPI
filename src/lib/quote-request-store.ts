import "server-only"

import { drizzle } from "drizzle-orm/d1"
import { getCloudflareContext } from "@opennextjs/cloudflare"

import { quoteRequests } from "@/db/schema"
import type { ContactSubmission } from "@/lib/contact-schema"

type QuoteRequestMetadata = {
  sourcePath: string
}

type D1Binding = Parameters<typeof drizzle>[0]

function resolveQuoteDbBinding(env: CloudflareEnv): D1Binding | null {
  return ((env as CloudflareEnv & { QUOTE_DB?: D1Binding }).QUOTE_DB ?? null) as D1Binding | null
}

export async function persistQuoteRequest(
  submission: ContactSubmission,
  metadata: QuoteRequestMetadata
): Promise<void> {
  if (submission.submissionType !== "quote") {
    return
  }

  let quoteDb: D1Binding | null = null

  try {
    const { env } = await getCloudflareContext({ async: true })
    quoteDb = resolveQuoteDbBinding(env)
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable.")
    }
  }

  if (!quoteDb) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("QUOTE_DB binding is missing.")
    }

    return
  }

  const db = drizzle(quoteDb)

  await db.insert(quoteRequests).values({
    id: crypto.randomUUID(),
    submissionType: submission.submissionType,
    name: submission.name,
    email: submission.email,
    company: submission.company,
    phone: submission.phone,
    state: submission.state,
    enquiryType: submission.enquiryType,
    preferredContactMethod: submission.preferredContactMethod,
    message: submission.message,
    sourcePath: metadata.sourcePath,
    createdAt: new Date(),
  })
}
