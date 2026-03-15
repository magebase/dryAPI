import { promises as fs } from "node:fs"
import path from "node:path"

const INDEX_URL = "https://docs.deapi.ai/llms.txt"
const DOCS_ORIGIN = "https://docs.deapi.ai"
const CURRENT_VERSION = "v1"

const outputRoot = path.join(process.cwd(), "docs", "deapi-mirror")
const articlesRoot = path.join(outputRoot, "articles")

const docsContentRoot = path.join(process.cwd(), "src", "content")
const docsVersionRoot = path.join(docsContentRoot, CURRENT_VERSION)
const deapiOpenApiDocumentPath = path.join(process.cwd(), "docs", "deapi-mirror", "articles", "openapi.json")

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim()
}

function toSectionKey(sourcePath) {
  if (sourcePath.startsWith("api/analysis/")) return "api-analysis"
  if (sourcePath.startsWith("api/generation/")) return "api-generation"
  if (sourcePath.startsWith("api/prompt-enhancement/")) return "api-prompt-enhancement"
  if (sourcePath.startsWith("api/transformation/")) return "api-transformation"
  if (sourcePath.startsWith("api/utilities/")) return "api-utilities"
  if (sourcePath.startsWith("api/")) return "api"
  if (sourcePath.startsWith("execution-modes-and-integrations/")) return "execution-modes-and-integrations"
  if (sourcePath.startsWith("other/")) return "other"

  if (
    sourcePath.startsWith("introduction")
    || sourcePath.startsWith("quickstart")
    || sourcePath.startsWith("pricing")
    || sourcePath.startsWith("models")
    || sourcePath.startsWith("limits-and-quotas")
    || sourcePath.startsWith("architecture-and-security")
  ) {
    return "core"
  }

  return "general"
}

function sectionTitleFromKey(key) {
  const titles = {
    core: "Core",
    api: "API",
    "api-analysis": "API / Analysis",
    "api-generation": "API / Generation",
    "api-prompt-enhancement": "API / Prompt Enhancement",
    "api-transformation": "API / Transformation",
    "api-utilities": "API / Utilities",
    "execution-modes-and-integrations": "Execution & Integrations",
    other: "Other",
    general: "General",
  }

  return titles[key] ?? "General"
}

function toRoutePath(sourcePath) {
  if (sourcePath.endsWith(".json")) {
    return `/docs/${CURRENT_VERSION}/openapi`
  }

  return `/docs/${CURRENT_VERSION}/${sourcePath.replace(/\.md$/i, "")}`
}

function toRouteSegments(routePath) {
  return routePath.replace(/^\/+/, "").split("/")
}

function normalizePathname(pathname) {
  if (!pathname) return "/"

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "")
  return withoutTrailingSlash || "/"
}

function toTitleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function fetchText(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

async function fetchBuffer(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function parseEntries(indexText) {
  const linkPattern = /\[([^\]]+)\]\((https:\/\/docs\.deapi\.ai\/[^)]+)\)/g
  const entries = []
  const seen = new Set()

  for (const match of indexText.matchAll(linkPattern)) {
    const title = normalizeWhitespace(match[1] ?? "")
    const url = normalizeWhitespace(match[2] ?? "")

    if (!title || !url || seen.has(url)) {
      continue
    }

    const parsed = new URL(url)
    const sourcePath = parsed.pathname.replace(/^\/+/, "")

    if (!sourcePath.endsWith(".md") && !sourcePath.endsWith(".json")) {
      continue
    }

    seen.add(url)
    entries.push({ title, url, sourcePath })
  }

  return entries
}

function convertCard(attrs, body) {
  const href = attrs.match(/\bhref\s*=\s*"([^"]+)"/i)?.[1] ?? ""
  const title = attrs.match(/\btitle\s*=\s*"([^"]+)"/i)?.[1] ?? "Related link"
  const bodyText = normalizeWhitespace(body)

  if (!href) return bodyText ? `\n> ${bodyText}\n` : ""
  if (!bodyText) return `\n- [${title}](${href})\n`
  return `\n- [${title}](${href}) - ${bodyText}\n`
}

function convertResponseField(attrs, body) {
  const name = attrs.match(/\bname\s*=\s*"([^"]+)"/i)?.[1] ?? "field"
  const type = attrs.match(/\btype\s*=\s*"([^"]+)"/i)?.[1] ?? "value"
  return `\n- \`${name}\` (${type}): ${normalizeWhitespace(body)}\n`
}

function convertCallout(kind, body) {
  const label = kind.toUpperCase()
  const text = body.trim().replace(/^[ \t]{2,}/gm, "").replace(/\n{3,}/g, "\n\n")

  if (!text) return ""

  const lines = text.split("\n").map((line) => `> ${line}`)
  return `\n> **${label}**\n>\n${lines.join("\n")}\n`
}

function stripMintlifyComponents(source) {
  return source
    .replace(/<Card([^>]*)>([\s\S]*?)<\/Card>/gi, (_, attrs, body) => convertCard(attrs, body))
    .replace(/<Card([^>]*)\/>/gi, (_, attrs) => convertCard(attrs, ""))
    .replace(/<ResponseField([^>]*)>([\s\S]*?)<\/ResponseField>/gi, (_, attrs, body) => convertResponseField(attrs, body))
    .replace(/<(Note|Info|Warning|Tip)[^>]*>([\s\S]*?)<\/(Note|Info|Warning|Tip)>/gi, (_, kind, body) => convertCallout(kind, body))
    .replace(/<\/(?:CardGroup|Tabs|Tab|AccordionGroup|Accordion|Steps|CodeGroup)>/gi, "")
    .replace(/<(?:CardGroup|Tabs|Tab|AccordionGroup|Accordion|Steps|CodeGroup)[^>]*>/gi, "")
    .replace(/<Step[^>]*title="([^"]+)"[^>]*>/gi, "\n### $1\n")
    .replace(/<\/?Step[^>]*>/gi, "")
    .replace(/<\/?Card[^>]*>/gi, "")
    .replace(/<\/?(?:Note|Info|Warning|Tip)[^>]*>/gi, "")
    .replace(/\n*Built with \[Mintlify\]\(https:\/\/mintlify\.com\)\.\s*$/i, "\n")
}

function resolveDocsLink(target, sourcePath, docsPathSet) {
  const value = target.trim()

  if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return target
  }

  const [href, hash = ""] = value.split("#")
  const hashSuffix = hash ? `#${hash}` : ""

  if (/^https?:\/\//i.test(href)) {
    const parsed = new URL(href)

    if (parsed.origin !== DOCS_ORIGIN) return target
    if (parsed.pathname.endsWith(".json")) return `/docs/${CURRENT_VERSION}/openapi${hashSuffix}`

    const normalized = normalizePathname(parsed.pathname.replace(/\.md$/i, ""))
    return docsPathSet.has(normalized) ? `/docs/${CURRENT_VERSION}${normalized}${hashSuffix}` : target
  }

  if (href.startsWith("/")) {
    if (href.startsWith("/docs/")) {
      const cleaned = href.replace(/^\/docs\/?/, "/")
      return `/docs/${CURRENT_VERSION}${cleaned}${hashSuffix}`
    }

    const normalized = normalizePathname(href.replace(/\.md$/i, ""))
    return docsPathSet.has(normalized) ? `/docs/${CURRENT_VERSION}${normalized}${hashSuffix}` : target
  }

  const sourceDir = path.posix.dirname(sourcePath)
  const resolved = path.posix.normalize(path.posix.join(sourceDir, href))

  if (resolved.endsWith(".json")) return `/docs/${CURRENT_VERSION}/openapi${hashSuffix}`

  const normalized = normalizePathname(resolved.replace(/\.md$/i, ""))
  return docsPathSet.has(normalized) ? `/docs/${CURRENT_VERSION}${normalized}${hashSuffix}` : target
}

function rewriteLinks(source, sourcePath, docsPathSet) {
  return source.replace(/(!?\[[^\]]*\]\()([^\)]+)(\))/g, (_, prefix, href, suffix) => {
    const rewritten = resolveDocsLink(href, sourcePath, docsPathSet)
    return `${prefix}${rewritten}${suffix}`
  })
}

function replaceOpenApiFenceWithApiPage(source) {
  const pattern = /(##\s+OpenAPI\s*\n+)?(`{3,4})yaml\s+openapi\.json\s+(get|post|put|patch|delete|head|options)\s+([^\n]+)\n[\s\S]*?\2/gi

  return source.replace(pattern, (_, heading, __fence, method, operationPath) => {
    const normalizedMethod = String(method).toLowerCase()
    const normalizedPath = String(operationPath).trim()
    const operations = JSON.stringify([{ path: normalizedPath, method: normalizedMethod }])
    const title = heading ? "## OpenAPI\n\n" : ""

    return `${title}<APIPage document={${JSON.stringify(deapiOpenApiDocumentPath)}} webhooks={[]} operations={${operations}} showTitle={true} />`
  })
}

function frontmatterBlock(values) {
  const lines = ["---"]

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue
    if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`)
      continue
    }

    lines.push(`${key}: ${JSON.stringify(value)}`)
  }

  lines.push("---", "")
  return lines.join("\n")
}

function toFumadocsMarkdown(source, entry, docsPathSet) {
  const stripped = stripMintlifyComponents(source)
  const rewritten = rewriteLinks(stripped, entry.sourcePath, docsPathSet)
  const withApiPages = replaceOpenApiFenceWithApiPage(rewritten)
  return `${frontmatterBlock({ title: entry.title })}${withApiPages.replace(/\n{3,}/g, "\n\n").trim()}\n`
}

function toManualOpenApiPage() {
  return [
    frontmatterBlock({
      title: "OpenAPI",
      description: "Machine-readable OpenAPI schema and generated API reference for dryAPI.",
      full: true,
    }).trimEnd(),
    "The machine-readable schema is available at [openapi.json](/openapi.json).",
    "",
    "Browse the generated [API reference](/docs/v1/api-reference).",
    "",
    "<OpenApiViewer />",
    "",
  ].join("\n")
}

function buildVersionLanding(entries) {
  const sectionFirstPages = new Map()

  for (const entry of entries) {
    if (entry.kind === "markdown" && !sectionFirstPages.has(entry.sectionTitle)) {
      sectionFirstPages.set(entry.sectionTitle, entry)
    }
  }

  const lines = [
    frontmatterBlock({
      title: `deAPI Documentation (${CURRENT_VERSION})`,
      description: "Generated mirror of the live deAPI documentation.",
    }).trimEnd(),
    "This version is generated from the live deAPI documentation index.",
    "",
    "## Sections",
    "",
  ]

  for (const [sectionTitle, entry] of sectionFirstPages.entries()) {
    lines.push(`- [${sectionTitle}](${entry.routePath})`)
  }

  lines.push(
    "",
    "## API schema",
    "",
    `- [OpenAPI schema](/docs/${CURRENT_VERSION}/openapi)`,
    `- [API reference](/docs/${CURRENT_VERSION}/api-reference)`,
    "",
    "---",
    "",
    "Generated by `pnpm docs:sync:deapi`.",
    ""
  )

  return lines.join("\n")
}

function buildRootLanding() {
  return [
    frontmatterBlock({
      title: "deAPI Docs Versions",
      description: "Available documentation versions for deAPI.",
    }).trimEnd(),
    `- [${CURRENT_VERSION} (latest)](/docs/${CURRENT_VERSION})`,
    "",
  ].join("\n")
}

function buildMetaPayloads(manifestEntries) {
  const orderedEntries = manifestEntries
    .filter((entry) => entry.kind === "markdown" || entry.kind === "openapi")
    .slice()
    .sort((left, right) => left.order - right.order)

  const metaByDirectory = new Map()

  function ensureMeta(directory) {
    if (!metaByDirectory.has(directory)) {
      const title = directory
        ? (directory === CURRENT_VERSION ? `${CURRENT_VERSION} (latest)` : toTitleCase(directory.split("/").at(-1)))
        : undefined

      metaByDirectory.set(directory, { title, pages: [] })
    }

    return metaByDirectory.get(directory)
  }

  function addPage(directory, slug) {
    const meta = ensureMeta(directory)
    if (!meta.pages.includes(slug)) meta.pages.push(slug)
  }

  ensureMeta("")
  addPage("", "index")
  addPage("", CURRENT_VERSION)
  ensureMeta(CURRENT_VERSION)
  addPage(CURRENT_VERSION, "index")

  for (const entry of orderedEntries) {
    const relativePath = entry.kind === "openapi" ? "openapi" : entry.sourcePath.replace(/\.md$/i, "")
    const segments = [CURRENT_VERSION, ...relativePath.split("/")]
    const slug = segments.at(-1)
    const parentDirectory = segments.slice(0, -1).join("/")

    for (let index = 1; index < segments.length; index += 1) {
      const directory = segments.slice(0, index).join("/")
      const parent = segments.slice(0, index - 1).join("/")
      ensureMeta(directory)
      addPage(parent, segments[index - 1])
    }

    if (slug) addPage(parentDirectory, slug)
  }

  addPage(CURRENT_VERSION, "api-reference")
  return metaByDirectory
}

async function writeMetaFiles(manifestEntries) {
  const metaByDirectory = buildMetaPayloads(manifestEntries)

  for (const [directory, meta] of metaByDirectory.entries()) {
    const targetDir = directory ? path.join(docsContentRoot, directory) : docsContentRoot
    await ensureDir(targetDir)
    await fs.writeFile(path.join(targetDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8")
  }
}

async function writeDocsContent(manifestEntries, markdownByPath, docsPathSet) {
  await fs.rm(docsContentRoot, { recursive: true, force: true })
  await ensureDir(docsVersionRoot)

  for (const entry of manifestEntries) {
    if (entry.kind !== "markdown") continue

    const source = markdownByPath.get(entry.sourcePath)
    if (!source) throw new Error(`Missing markdown source for ${entry.sourcePath}`)

    const targetRelativePath = entry.sourcePath.replace(/\.md$/i, ".mdx")
    const targetPath = path.join(docsVersionRoot, targetRelativePath)
    await ensureDir(path.dirname(targetPath))
    await fs.writeFile(targetPath, toFumadocsMarkdown(source, entry, docsPathSet), "utf8")
  }

  await fs.writeFile(path.join(docsVersionRoot, "openapi.mdx"), toManualOpenApiPage(), "utf8")
  await fs.writeFile(path.join(docsVersionRoot, "index.mdx"), buildVersionLanding(manifestEntries), "utf8")
  await fs.writeFile(path.join(docsContentRoot, "index.mdx"), buildRootLanding(), "utf8")
  await writeMetaFiles(manifestEntries)
}

async function writeContentEntries(entries) {
  const manifestEntries = []
  const markdownByPath = new Map()

  for (const [order, entry] of entries.entries()) {
    const destinationPath = path.join(articlesRoot, entry.sourcePath)
    await ensureDir(path.dirname(destinationPath))

    if (entry.sourcePath.endsWith(".json")) {
      const content = await fetchBuffer(entry.url)
      await fs.writeFile(destinationPath, content)
    } else {
      const content = await fetchText(entry.url)
      await fs.writeFile(destinationPath, content, "utf8")
      markdownByPath.set(entry.sourcePath, content)
    }

    const sectionKey = toSectionKey(entry.sourcePath)
    const sectionTitle = sectionTitleFromKey(sectionKey)
    const routePath = toRoutePath(entry.sourcePath)

    manifestEntries.push({
      id: entry.sourcePath,
      title: entry.title,
      url: entry.url,
      sourcePath: entry.sourcePath,
      routePath,
      routeSegments: toRouteSegments(routePath),
      sectionKey,
      sectionTitle,
      kind: entry.sourcePath.endsWith(".json") ? "openapi" : "markdown",
      order,
    })
  }

  const docsPathSet = new Set(
    manifestEntries
      .filter((entry) => entry.kind === "markdown")
      .map((entry) => normalizePathname(entry.sourcePath.replace(/\.md$/i, "")))
  )

  docsPathSet.add("/openapi")

  await writeDocsContent(manifestEntries, markdownByPath, docsPathSet)
  return manifestEntries
}

async function main() {
  await ensureDir(outputRoot)
  await ensureDir(articlesRoot)

  const indexText = await fetchText(INDEX_URL)
  await fs.writeFile(path.join(outputRoot, "llms.txt"), indexText, "utf8")

  const entries = parseEntries(indexText)
  if (entries.length === 0) throw new Error("No entries discovered in llms.txt")

  const manifestEntries = await writeContentEntries(entries)

  const manifest = {
    source: {
      indexUrl: INDEX_URL,
      docsOrigin: DOCS_ORIGIN,
      syncedAt: new Date().toISOString(),
    },
    totalEntries: manifestEntries.length,
    entries: manifestEntries,
  }

  await fs.writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

  const markdownCount = manifestEntries.filter((entry) => entry.kind === "markdown").length
  const openApiCount = manifestEntries.filter((entry) => entry.kind === "openapi").length

  console.log(`Synced ${manifestEntries.length} docs entries (${markdownCount} markdown, ${openApiCount} openapi).`)
  console.log(`Mirror output: ${outputRoot}`)
  console.log(`Fumadocs content output: ${docsVersionRoot}`)
}

await main()
