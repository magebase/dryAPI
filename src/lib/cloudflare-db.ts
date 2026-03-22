import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { withReplicas } from "drizzle-orm/sqlite-core";
import { cache } from "react";

import { formatExpectedBindings, resolveD1Binding } from "@/lib/d1-bindings";
import { instrumentD1Binding } from "@/lib/d1-observability";
import { resolveDrizzleCache } from "@/lib/drizzle-cache";

type D1Binding = Parameters<typeof drizzle>[0];
type D1SessionCapableBinding = D1Binding & {
  withSession?: (constraint?: string) => D1Binding;
};
type DrizzleDatabase = ReturnType<typeof drizzle>;
type BindingKey = string | readonly string[];

type CloudflareDbAccessors = {
  getBinding: () => D1Binding;
  getBindingAsync: () => Promise<D1Binding>;
  getPrimaryBinding: () => D1Binding;
  getPrimaryBindingAsync: () => Promise<D1Binding>;
  getDb: () => DrizzleDatabase;
  getDbAsync: () => Promise<DrizzleDatabase>;
  getPrimaryDb: () => DrizzleDatabase;
  getPrimaryDbAsync: () => Promise<DrizzleDatabase>;
};

function normalizeBindingKeys(bindingKey: BindingKey): readonly string[] {
  if (typeof bindingKey === "string") {
    return [bindingKey];
  }

  return bindingKey;
}

function resolveBinding(
  env: Record<string, unknown>,
  bindingKey: BindingKey,
): D1Binding {
  const bindingKeys = normalizeBindingKeys(bindingKey);
  const binding = resolveD1Binding<D1Binding>(env, bindingKeys);

  if (!binding) {
    throw new Error(
      `Cloudflare D1 binding ${formatExpectedBindings(bindingKeys)} is unavailable.`,
    );
  }

  return binding;
}

function startSession(
  binding: D1Binding,
  constraint: "first-primary" | "first-unconstrained",
): D1Binding {
  const sessionCapableBinding = binding as D1SessionCapableBinding;

  if (typeof sessionCapableBinding.withSession !== "function") {
    return binding;
  }

  return sessionCapableBinding.withSession(constraint);
}

function createDrizzleDb<TSchema extends Record<string, unknown>>(
  binding: D1Binding,
  schema: TSchema,
): DrizzleDatabase {
  const drizzleCache = resolveDrizzleCache();

  return drizzle(binding, {
    schema,
    ...(drizzleCache ? { cache: drizzleCache } : {}),
  });
}

function resolveInstrumentedBinding(
  env: Record<string, unknown>,
  bindingKey: BindingKey,
): D1Binding {
  const bindingKeys = normalizeBindingKeys(bindingKey);
  const primaryBindingName = bindingKeys[0]!;

  return instrumentD1Binding(resolveBinding(env, bindingKeys), {
    bindingName: primaryBindingName,
    component: `drizzle.${primaryBindingName.toLowerCase()}`,
  });
}

export function createCloudflareDbAccessors<TSchema extends Record<string, unknown>>(
  bindingKey: BindingKey,
  schema: TSchema,
): CloudflareDbAccessors {
  const getBinding = cache(() => {
    const { env } = getCloudflareContext();
    return startSession(
      resolveInstrumentedBinding(env as Record<string, unknown>, bindingKey),
      "first-unconstrained",
    );
  });

  const getBindingAsync = cache(async () => {
    const { env } = await getCloudflareContext({ async: true });
    return startSession(
      resolveInstrumentedBinding(env as Record<string, unknown>, bindingKey),
      "first-unconstrained",
    );
  });

  const getPrimaryBinding = cache(() => {
    const { env } = getCloudflareContext();
    return startSession(
      resolveInstrumentedBinding(env as Record<string, unknown>, bindingKey),
      "first-primary",
    );
  });

  const getPrimaryBindingAsync = cache(async () => {
    const { env } = await getCloudflareContext({ async: true });
    return startSession(
      resolveInstrumentedBinding(env as Record<string, unknown>, bindingKey),
      "first-primary",
    );
  });

  const getPrimaryDb = cache(() => createDrizzleDb(getPrimaryBinding(), schema));

  const getDb = cache(
    () => withReplicas(getPrimaryDb(), [createDrizzleDb(getBinding(), schema)]) as DrizzleDatabase,
  );

  const getPrimaryDbAsync = cache(async () => createDrizzleDb(await getPrimaryBindingAsync(), schema));

  const getDbAsync = cache(async () => {
    const primaryDb = await getPrimaryDbAsync();
    const replicaDb = createDrizzleDb(await getBindingAsync(), schema);
    return withReplicas(primaryDb, [replicaDb]) as DrizzleDatabase;
  });

  return {
    getBinding,
    getBindingAsync,
    getPrimaryBinding,
    getPrimaryBindingAsync,
    getDb,
    getDbAsync,
    getPrimaryDb,
    getPrimaryDbAsync,
  };
}