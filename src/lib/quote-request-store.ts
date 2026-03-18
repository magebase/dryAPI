import "server-only";

import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { quoteRequests } from "@/db/schema-analytics";
import {
  D1_BINDING_PRIORITY,
  formatExpectedBindings,
  resolveD1Binding,
} from "@/lib/d1-bindings";
import type { ContactSubmission } from "@/lib/contact-schema";

type QuoteRequestMetadata = {
  sourcePath: string;
};

type D1Binding = Parameters<typeof drizzle>[0];

function resolveQuoteDbBinding(env: Record<string, unknown>): D1Binding | null {
  return resolveD1Binding<D1Binding>(env, D1_BINDING_PRIORITY.analytics);
}

export async function persistQuoteRequest(
  submission: ContactSubmission,
  metadata: QuoteRequestMetadata,
): Promise<void> {
  if (submission.submissionType !== "quote") {
    return;
  }

  let quoteDb: D1Binding | null = null;

  try {
    const { env } = await getCloudflareContext({ async: true });
    quoteDb = resolveQuoteDbBinding(env as unknown as Record<string, unknown>);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable.");
    }
  }

  if (!quoteDb) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `${formatExpectedBindings(D1_BINDING_PRIORITY.analytics)} binding is missing.`,
      );
    }

    return;
  }

  const db = drizzle(quoteDb);

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
  });
}
