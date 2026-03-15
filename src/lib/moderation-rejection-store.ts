import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import { moderationRejections } from "@/db/schema";

type D1Binding = Parameters<typeof drizzle>[0];

type ModerationRejectionAttempt = {
  channel: "contact" | "quote" | "chat";
  sourcePath: string;
  reason: string;
  model: string;
  categories: string[];
};

function resolveQuoteDbBinding(env: Record<string, unknown>): D1Binding | null {
  return ((env.APP_DB ?? env.TINA_DB ?? null) as D1Binding | null) || null;
}

export async function persistModerationRejectionAttempt(
  attempt: ModerationRejectionAttempt,
): Promise<void> {
  let quoteDb: D1Binding | null = null;

  try {
    const { env } = await getCloudflareContext({ async: true });
    quoteDb = resolveQuoteDbBinding(env as Record<string, unknown>);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable.");
    }
  }

  if (!quoteDb) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_DB binding is missing.");
    }

    return;
  }

  const db = drizzle(quoteDb);

  await db.insert(moderationRejections).values({
    id: crypto.randomUUID(),
    channel: attempt.channel,
    sourcePath: attempt.sourcePath,
    reason: attempt.reason,
    model: attempt.model,
    categories: attempt.categories.join(","),
    createdAt: new Date(),
  });
}
