import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";

type D1Binding = Parameters<typeof drizzle>[0];

type CloudflareDbAccessors<TSchema extends Record<string, unknown>> = {
  getBinding: () => D1Binding;
  getBindingAsync: () => Promise<D1Binding>;
  getDb: () => ReturnType<typeof drizzle>;
  getDbAsync: () => Promise<ReturnType<typeof drizzle>>;
};

function resolveBinding(
  env: Record<string, unknown>,
  bindingKey: string,
): D1Binding {
  const binding = env[bindingKey] as D1Binding | null | undefined;

  if (!binding) {
    throw new Error(`Cloudflare D1 binding ${bindingKey} is unavailable.`);
  }

  return binding;
}

export function createCloudflareDbAccessors<TSchema extends Record<string, unknown>>(
  bindingKey: string,
  schema: TSchema,
): CloudflareDbAccessors<TSchema> {
  const getBinding = cache(() => {
    const { env } = getCloudflareContext();
    return resolveBinding(env as Record<string, unknown>, bindingKey);
  });

  const getBindingAsync = cache(async () => {
    const { env } = await getCloudflareContext({ async: true });
    return resolveBinding(env as Record<string, unknown>, bindingKey);
  });

  const getDb = cache(() => drizzle(getBinding(), { schema }));

  const getDbAsync = cache(async () => drizzle(await getBindingAsync(), { schema }));

  return {
    getBinding,
    getBindingAsync,
    getDb,
    getDbAsync,
  };
}