import "server-only";

import * as analyticsSchema from "@/db/schema-analytics";
import { createCloudflareDbAccessors } from "@/lib/cloudflare-db";
import type { ContactSubmission } from "@/lib/contact-schema";

type QuoteRequestMetadata = {
  sourcePath: string;
};

const { getDbAsync } = createCloudflareDbAccessors(
  "APP_DB",
  analyticsSchema,
);

export async function persistQuoteRequest(
  submission: ContactSubmission,
  metadata: QuoteRequestMetadata,
): Promise<void> {
  if (submission.submissionType !== "quote") {
    return;
  }

  let quoteDb: Awaited<ReturnType<typeof getDbAsync>> | null = null;

  try {
    quoteDb = await getDbAsync();
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable.");
    }
  }

  if (!quoteDb) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare database APP_DB is unavailable.");
    }

    return;
  }

  await quoteDb.insert(analyticsSchema.quoteRequests).values({
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
