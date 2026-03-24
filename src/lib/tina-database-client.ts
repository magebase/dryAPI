import { createDatabase, FilesystemBridge } from "@tinacms/datalayer";
import { resolve as resolveTinaQuery } from "@tinacms/graphql";
import type { Level } from "@tinacms/graphql";
import type { Schema } from "@tinacms/schema-tools";

import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
  type PgDatabaseLike,
} from "@/lib/cloudflare-db";
import { DrizzleD1Level } from "@/lib/tina/drizzle-d1-level";
import homeContentArtifact from "../../content/site/home.json";
import siteConfigContentArtifact from "../../content/site/site-config.json";
import graphQLSchemaArtifact from "../../tina/__generated__/_graphql.json";
import tinaSchemaArtifact from "../../tina/__generated__/_schema.json";
import lookupArtifact from "../../tina/__generated__/_lookup.json";

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.CF_PAGES_BRANCH ||
  "main";

const { getSqlDbAsync } = createCloudflareDbAccessors(
  HYPERDRIVE_BINDING_PRIORITY,
  {},
)

type D1Binding = PgDatabaseLike;
type TinaRequestArgs = {
  query: string;
  variables?: Record<string, unknown>;
  user?: unknown;
};

type TinaGeneratedArtifacts = {
  graphQLSchema: Record<string, unknown>;
  tinaSchemaDocument: Schema<false>;
  lookup: Record<string, unknown>;
};

type TinaResolveResult = {
  errors?: Array<{ message?: string }>;
};

function hasGraphQLSchemaDrift(
  indexedSchema: unknown,
  generatedSchema: Record<string, unknown>,
): boolean {
  if (!indexedSchema || typeof indexedSchema !== "object") {
    return true;
  }

  try {
    return JSON.stringify(indexedSchema) !== JSON.stringify(generatedSchema);
  } catch {
    // Fall back to reindexing if either schema cannot be serialized safely.
    return true;
  }
}

const CORE_SITE_RECORDS = [
  {
    key: "content/site/home.json",
    collectionName: "home",
    payload: homeContentArtifact as Record<string, unknown>,
  },
  {
    key: "content/site/site-config.json",
    collectionName: "siteConfig",
    payload: siteConfigContentArtifact as Record<string, unknown>,
  },
] as const;

const CORE_SITE_RECORD_KEYS = CORE_SITE_RECORDS.map((record) => record.key);

function toTinaCtxUser(user: unknown): { sub: string } | undefined {
  if (!user || typeof user !== "object") {
    return undefined;
  }

  const record = user as Record<string, unknown>;
  const subject = [record.sub, record.id, record.email].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return subject ? { sub: subject } : undefined;
}

async function resolveTinaD1Binding(): Promise<D1Binding | null> {
  return getSqlDbAsync();
}

function createFilesystemGitProvider(bridge: FilesystemBridge) {
  return {
    // Database.put already writes through `bridge`; keep hooks as no-ops.
    onPut: async (_key: string, _value: string) => {},
    onDelete: async (_key: string) => {},
  };
}

function normalizeBridgePath(filepath: string): string {
  return filepath.replace(/^\.\//, "").replace(/^\/+/, "");
}

function createWorkerSafeBridge(): FilesystemBridge {
  const filesystemBridge = new FilesystemBridge(process.cwd());
  const originalGet = filesystemBridge.get.bind(filesystemBridge);
  const originalPut = filesystemBridge.put.bind(filesystemBridge);
  const originalDelete = filesystemBridge.delete.bind(filesystemBridge);
  const isReadonlyBridge = process.env.NODE_ENV === "production";

  filesystemBridge.get = async (filepath: string) => {
    const normalizedPath = normalizeBridgePath(filepath);
    const coreRecord = CORE_SITE_RECORDS.find(
      (record) => record.key === normalizedPath,
    );

    if (coreRecord) {
      return JSON.stringify(coreRecord.payload);
    }

    return originalGet(filepath);
  };

  filesystemBridge.put = async (filepath: string, data: string) => {
    if (isReadonlyBridge) {
      return;
    }

    return originalPut(filepath, data);
  };

  filesystemBridge.delete = async (filepath: string) => {
    if (isReadonlyBridge) {
      return;
    }

    return originalDelete(filepath);
  };

  return filesystemBridge;
}

const tinaDatabase = (() => {
  const bridge = createWorkerSafeBridge();
  const d1Level = new DrizzleD1Level<string, Record<string, unknown>>({
    namespace: branch,
    resolveBinding: resolveTinaD1Binding,
  }) as unknown as Level;

  return createDatabase({
    bridge,
    databaseAdapter: d1Level,
    gitProvider: createFilesystemGitProvider(bridge),
    namespace: branch,
    tinaDirectory: "tina",
  });
})();

let tinaMetadataReady = false;
let tinaMetadataBootstrapPromise: Promise<void> | null = null;
let coreSiteRecordsSeedPromise: Promise<void> | null = null;

function isMissingGraphQLSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const typedError = error as { message?: unknown; code?: unknown };
  const message =
    typeof typedError.message === "string"
      ? typedError.message.toLowerCase()
      : "";

  if (typedError.code === "LEVEL_NOT_FOUND") {
    return true;
  }

  return (
    message.includes("graphql schema not found") ||
    (message.includes("_graphql.json") && message.includes("not found"))
  );
}

async function readGeneratedArtifacts(): Promise<TinaGeneratedArtifacts> {
  return {
    graphQLSchema: graphQLSchemaArtifact as Record<string, unknown>,
    tinaSchemaDocument: tinaSchemaArtifact as unknown as Schema<false>,
    lookup: lookupArtifact as Record<string, unknown>,
  };
}

async function ensureTinaMetadataIndexed(): Promise<void> {
  if (tinaMetadataReady) {
    return;
  }

  if (tinaMetadataBootstrapPromise) {
    return tinaMetadataBootstrapPromise;
  }

  tinaMetadataBootstrapPromise = (async () => {
    const { graphQLSchema, tinaSchemaDocument, lookup } =
      await readGeneratedArtifacts();

    let shouldReindex = false;

    try {
      const existingGraphQLSchema = await tinaDatabase.getGraphQLSchema();
      shouldReindex = hasGraphQLSchemaDrift(
        existingGraphQLSchema,
        graphQLSchema,
      );
    } catch (error) {
      if (!isMissingGraphQLSchemaError(error)) {
        throw error;
      }

      shouldReindex = true;
    }

    if (!shouldReindex) {
      tinaMetadataReady = true;
      return;
    }

    const tinaSchema = await tinaDatabase.getSchema(
      undefined,
      tinaSchemaDocument,
    );

    await tinaDatabase.indexContent({
      graphQLSchema: graphQLSchema as never,
      tinaSchema,
      lookup,
    });

    tinaMetadataReady = true;
  })();

  try {
    await tinaMetadataBootstrapPromise;
  } catch (error) {
    tinaMetadataBootstrapPromise = null;
    throw error;
  }
}

function invalidateTinaMetadataCache(): void {
  tinaMetadataReady = false;
  tinaMetadataBootstrapPromise = null;
}

async function seedCoreSiteRecords(): Promise<void> {
  if (coreSiteRecordsSeedPromise) {
    return coreSiteRecordsSeedPromise;
  }

  coreSiteRecordsSeedPromise = (async () => {
    await Promise.all(
      CORE_SITE_RECORDS.map(async (record) => {
        const exists = await tinaDatabase.documentExists(record.key);
        if (exists) {
          return;
        }

        const payload = JSON.parse(JSON.stringify(record.payload)) as Record<
          string,
          unknown
        >;

        await tinaDatabase.put(record.key, payload, record.collectionName);
      }),
    );
  })();

  try {
    await coreSiteRecordsSeedPromise;
  } catch (error) {
    coreSiteRecordsSeedPromise = null;
    throw error;
  }
}

function resultHasMissingGraphQLSchemaError(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  const maybeResult = result as TinaResolveResult;
  if (!Array.isArray(maybeResult.errors) || maybeResult.errors.length === 0) {
    return false;
  }

  return maybeResult.errors.some((error) => {
    const message =
      typeof error?.message === "string" ? error.message.toLowerCase() : "";
    return message.includes("graphql schema not found");
  });
}

function messageHasMissingCoreSiteRecord(message: string): boolean {
  const normalized = message.toLowerCase();

  return CORE_SITE_RECORD_KEYS.some((recordKey) => {
    return normalized.includes(`unable to find record ${recordKey}`);
  });
}

function resultHasMissingCoreSiteRecordError(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  const maybeResult = result as TinaResolveResult;
  if (!Array.isArray(maybeResult.errors) || maybeResult.errors.length === 0) {
    return false;
  }

  return maybeResult.errors.some((error) => {
    const message = typeof error?.message === "string" ? error.message : "";
    return messageHasMissingCoreSiteRecord(message);
  });
}

function isMissingCoreSiteRecordError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    message?: unknown;
    errors?: Array<{ message?: unknown }>;
  };

  if (
    typeof maybeError.message === "string" &&
    messageHasMissingCoreSiteRecord(maybeError.message)
  ) {
    return true;
  }

  if (!Array.isArray(maybeError.errors)) {
    return false;
  }

  return maybeError.errors.some((innerError) => {
    return (
      typeof innerError?.message === "string" &&
      messageHasMissingCoreSiteRecord(innerError.message)
    );
  });
}

function resolveTinaRequest({ query, variables, user }: TinaRequestArgs) {
  return resolveTinaQuery({
    config: { useRelativeMedia: true },
    query,
    variables: variables ?? {},
    database: tinaDatabase,
    // Tina resolver logs handled GraphQL errors internally unless silenced.
    // We retry schema bootstrap ourselves in `request()` below.
    silenceErrors: true,
    verbose: false,
    ctxUser: toTinaCtxUser(user),
  });
}

const databaseClient = {
  async request({ query, variables, user }: TinaRequestArgs) {
    await ensureTinaMetadataIndexed();

    try {
      const firstResult = await resolveTinaRequest({ query, variables, user });

      if (
        !resultHasMissingGraphQLSchemaError(firstResult) &&
        !resultHasMissingCoreSiteRecordError(firstResult)
      ) {
        return firstResult;
      }

      if (resultHasMissingCoreSiteRecordError(firstResult)) {
        await seedCoreSiteRecords();

        const secondResult = await resolveTinaRequest({
          query,
          variables,
          user,
        });
        if (!resultHasMissingCoreSiteRecordError(secondResult)) {
          return secondResult;
        }
      }

      invalidateTinaMetadataCache();
      await ensureTinaMetadataIndexed();

      await seedCoreSiteRecords();

      return resolveTinaRequest({ query, variables, user });
    } catch (error) {
      if (
        !isMissingGraphQLSchemaError(error) &&
        !isMissingCoreSiteRecordError(error)
      ) {
        throw error;
      }

      if (isMissingCoreSiteRecordError(error)) {
        await seedCoreSiteRecords();

        const secondAttempt = await resolveTinaRequest({
          query,
          variables,
          user,
        });
        if (!resultHasMissingCoreSiteRecordError(secondAttempt)) {
          return secondAttempt;
        }
      }

      invalidateTinaMetadataCache();
      await ensureTinaMetadataIndexed();

      await seedCoreSiteRecords();

      return resolveTinaRequest({ query, variables, user });
    }
  },
};

export default databaseClient;
