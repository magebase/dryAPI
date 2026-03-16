import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import { moderationRejections } from "@/db/schema-analytics";
import {
  D1_BINDING_PRIORITY,
  formatExpectedBindings,
  resolveD1Binding,
} from "@/lib/d1-bindings";

type D1Binding = Parameters<typeof drizzle>[0];

type ModerationRejectionAttempt = {
  channel: "contact" | "quote" | "chat";
  sourcePath: string;
  reason: string;
  model: string;
  categories: string[];
};

function resolveQuoteDbBinding(env: Record<string, unknown>): D1Binding | null {
  return resolveD1Binding<D1Binding>(env, D1_BINDING_PRIORITY.analytics);
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
      throw new Error(
        `${formatExpectedBindings(D1_BINDING_PRIORITY.analytics)} binding is missing.`,
      );
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
