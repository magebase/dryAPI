import "server-only";

import * as analyticsSchema from "@/db/schema-analytics";
import { createCloudflareDbAccessors } from "@/lib/cloudflare-db";

const { getDbAsync } = createCloudflareDbAccessors(
  "ANALYTICS_DB",
  analyticsSchema,
);

type ModerationRejectionAttempt = {
  channel: "contact" | "quote" | "chat";
  sourcePath: string;
  reason: string;
  model: string;
  categories: string[];
};

export async function persistModerationRejectionAttempt(
  attempt: ModerationRejectionAttempt,
): Promise<void> {
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
      throw new Error("Cloudflare D1 binding ANALYTICS_DB is unavailable.");
    }

    return;
  }

  await quoteDb.insert(analyticsSchema.moderationRejections).values({
    id: crypto.randomUUID(),
    channel: attempt.channel,
    sourcePath: attempt.sourcePath,
    reason: attempt.reason,
    model: attempt.model,
    categories: attempt.categories.join(","),
    createdAt: new Date(),
  });
}
