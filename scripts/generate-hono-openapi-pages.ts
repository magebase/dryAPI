// @ts-nocheck
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const openApiJsonPath = path.join(
  "docs",
  "deapi-mirror",
  "articles",
  "openapi.hono.json",
);
const outputDir = path.join(
  process.cwd(),
  "src",
  "content",
  "v1",
  "api-reference",
);
const outputBaseUrl = "/docs/v1/api-reference";
const defaultOpenApiUrl =
  process.env.HONO_OPENAPI_URL ?? "http://127.0.0.1:8787/openapi.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHonoGatewaySpec(openapi) {
  const paths = openapi?.paths;
  if (!paths || typeof paths !== "object") {
    return false;
  }

  return [
    "/v1/chat/completions",
    "/v1/images/generations",
    "/v1/audio/transcriptions",
    "/v1/embeddings",
  ].some((routePath) => routePath in paths);
}

async function fetchOpenApiDocument(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const openapi = await response.json();

  if (!openapi.openapi || !openapi.paths) {
    throw new Error(
      "OpenAPI object is missing required fields: openapi, paths",
    );
  }

  return openapi;
}

async function resolveOpenApiFromRunningServer(url) {
  try {
    const openapi = await fetchOpenApiDocument(url);
    return isHonoGatewaySpec(openapi) ? openapi : null;
  } catch {
    return null;
  }
}

function startLocalWranglerDev(port) {
  const wranglerCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(
    wranglerCommand,
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      "cloudflare/api/wrangler.toml",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--local",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
      },
    },
  );

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  return {
    child,
    getLogs: () => logs,
  };
}

async function resolveOpenApiDocument() {
  const direct = await resolveOpenApiFromRunningServer(defaultOpenApiUrl);
  if (direct) {
    return direct;
  }

  const tempPort = Number.parseInt(
    process.env.HONO_OPENAPI_TEMP_PORT ?? "8788",
    10,
  );
  const localUrl = `http://127.0.0.1:${tempPort}/openapi.json`;
  const { child, getLogs } = startLocalWranglerDev(tempPort);

  const stopWrangler = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
      await sleep(250);
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  };

  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const openapi = await resolveOpenApiFromRunningServer(localUrl);
      if (openapi) {
        return openapi;
      }

      await sleep(500);
    }

    throw new Error(
      `Timed out waiting for local worker OpenAPI endpoint at ${localUrl}.\nWrangler logs:\n${getLogs()}`,
    );
  } finally {
    await stopWrangler();
  }
}

async function ensureApiReferenceMeta() {
  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  const pages = ["index"];

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".mdx") ||
      entry.name === "index.mdx"
    ) {
      continue;
    }

    pages.push(entry.name.replace(/\.mdx$/i, ""));
  }

  const meta = {
    title: "API Reference",
    pages,
  };

  await fs.writeFile(
    path.join(outputDir, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const { generateFiles } = await import("fumadocs-openapi");
  const { createOpenAPI } = await import("fumadocs-openapi/server");

  const openapi = await resolveOpenApiDocument();

  await fs.mkdir(path.dirname(openApiJsonPath), { recursive: true });
  await fs.writeFile(
    openApiJsonPath,
    `${JSON.stringify(openapi, null, 2)}\n`,
    "utf8",
  );

  const server = createOpenAPI({
    input: [openApiJsonPath],
    proxyUrl: "/api/proxy",
  });

  await fs.rm(outputDir, { recursive: true, force: true });

  await generateFiles({
    input: server,
    output: outputDir,
    per: "tag",
    name: (entry) => {
      if (entry.type !== "tag") {
        return entry.path;
      }

      const tagName = entry.rawTag?.name ?? entry.info.title;
      return (
        tagName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "general"
      );
    },
    index: {
      url: (filePath) => {
        const slug = filePath.replace(/\.mdx$/i, "");
        return `${outputBaseUrl}/${slug}`;
      },
      items: [
        {
          path: "index.mdx",
          title: "OpenAPI Reference",
          description: "Generated from the dryAPI/dryAPI gateway schema.",
        },
      ],
    },
    frontmatter: (title, description, context) => {
      if (context.type === "tag") {
        const tagTitle =
          context.tag?.["x-displayName"] ?? context.tag?.name ?? title;
        return {
          title: String(tagTitle).replace(/[-_]+/g, " "),
          description,
        };
      }

      return { title, description };
    },
    addGeneratedComment:
      "Auto-generated from Hono openapi route metadata and TypeBox validators.",
  });

  await ensureApiReferenceMeta();

  console.log(`Wrote Hono schema: ${openApiJsonPath}`);
  console.log(`Generated OpenAPI pages: ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
