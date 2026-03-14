import { promises as fs } from "node:fs"
import path from "node:path"

const INDEX_URL = "https://docs.deapi.ai/llms.txt"
const DOCS_ORIGIN = "https://docs.deapi.ai"
const CURRENT_VERSION = "v1"

const outputRoot = path.join(process.cwd(), "docs", "deapi-mirror")
const articlesRoot = path.join(outputRoot, "articles")

const nextraContentRoot = path.join(process.cwd(), "src", "content")
const nextraVersionRoot = path.join(nextraContentRoot, CURRENT_VERSION)

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim()
}

function toSectionKey(sourcePath) {
  if (sourcePath.startsWith("api/analysis/")) {
    return "api-analysis"
  }

  if (sourcePath.startsWith("api/generation/")) {
    return "api-generation"
  }

  if (sourcePath.startsWith("api/prompt-enhancement/")) {
    return "api-prompt-enhancement"
  }

  if (sourcePath.startsWith("api/transformation/")) {
    return "api-transformation"
  }

  if (sourcePath.startsWith("api/utilities/")) {
    return "api-utilities"
  }

  if (sourcePath.startsWith("api/")) {
    return "api"
  }

  if (sourcePath.startsWith("execution-modes-and-integrations/")) {
    return "execution-modes-and-integrations"
  }

  if (sourcePath.startsWith("other/")) {
    return "other"
  }

  if (
    sourcePath.startsWith("introduction") ||
    sourcePath.startsWith("quickstart") ||
    sourcePath.startsWith("pricing") ||
    sourcePath.startsWith("models") ||
    sourcePath.startsWith("limits-and-quotas") ||
    sourcePath.startsWith("architecture-and-security")
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

  const pathname = sourcePath.replace(/\.md$/i, "")
  return `/docs/${CURRENT_VERSION}/${pathname}`
}

function toRouteSegments(routePath) {
  return routePath.replace(/^\/+/, "").split("/")
}

function normalizePathname(pathname) {
  if (!pathname) {
    return "/"
  }

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

    entries.push({
      title,
      url,
      sourcePath,
    })
  }

  return entries
}

function convertCard(attrs, body) {
  const href = attrs.match(/\bhref\s*=\s*"([^"]+)"/i)?.[1] ?? ""
  const title = attrs.match(/\btitle\s*=\s*"([^"]+)"/i)?.[1] ?? "Related link"
  const bodyText = normalizeWhitespace(body)

  if (!href) {
    return bodyText ? `\n> ${bodyText}\n` : ""
  }

  if (!bodyText) {
    return `\n- [${title}](${href})\n`
  }

  return `\n- [${title}](${href}) - ${bodyText}\n`
}

function convertResponseField(attrs, body) {
  const name = attrs.match(/\bname\s*=\s*"([^"]+)"/i)?.[1] ?? "field"
  const type = attrs.match(/\btype\s*=\s*"([^"]+)"/i)?.[1] ?? "value"
  const text = normalizeWhitespace(body)
  return `\n- \`${name}\` (${type}): ${text}\n`
}

function convertCallout(kind, body) {
  const label = kind.toUpperCase()
  const text = body
    .trim()
    .replace(/^[ \t]{2,}/gm, "")
    .replace(/\n{3,}/g, "\n\n")

  if (!text) {
    return ""
  }

  const lines = text.split("\n").map((line) => `> ${line}`)
  return `\n> **${label}**\n>\n${lines.join("\n")}\n`
}

function stripMintlifyComponents(source) {
  return source
    .replace(/<Card([^>]*)>([\s\S]*?)<\/Card>/gi, (_, attrs, body) => convertCard(attrs, body))
    .replace(/<Card([^>]*)\/>/gi, (_, attrs) => convertCard(attrs, ""))
    .replace(/<ResponseField([^>]*)>([\s\S]*?)<\/ResponseField>/gi, (_, attrs, body) => convertResponseField(attrs, body))
    .replace(/<(Note|Info|Warning|Tip)[^>]*>([\s\S]*?)<\/(Note|Info|Warning|Tip)>/gi, (_, kind, body) =>
      convertCallout(kind, body)
    )
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

    if (parsed.origin !== DOCS_ORIGIN) {
      return target
    }

    if (parsed.pathname.endsWith(".json")) {
      return `/docs/${CURRENT_VERSION}/openapi${hashSuffix}`
    }

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

  if (resolved.endsWith(".json")) {
    return `/docs/${CURRENT_VERSION}/openapi${hashSuffix}`
  }

  const normalized = normalizePathname(resolved.replace(/\.md$/i, ""))
  return docsPathSet.has(normalized) ? `/docs/${CURRENT_VERSION}${normalized}${hashSuffix}` : target
}

function rewriteLinks(source, sourcePath, docsPathSet) {
  return source.replace(/(!?\[[^\]]*\]\()([^\)]+)(\))/g, (_, prefix, href, suffix) => {
    const rewritten = resolveDocsLink(href, sourcePath, docsPathSet)
    return `${prefix}${rewritten}${suffix}`
  })
}

function toNextraMarkdown(source, sourcePath, docsPathSet) {
  const stripped = stripMintlifyComponents(source)
  const rewritten = rewriteLinks(stripped, sourcePath, docsPathSet)
  return rewritten.replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

function metaToJs(metaObject) {
  const lines = ["export default {"]

  for (const [key, value] of metaObject) {
    const serializedValue =
      typeof value === "string"
        ? JSON.stringify(value)
        : JSON.stringify(value, null, 2)
            .split("\n")
            .map((line, index) => (index === 0 ? line : `  ${line}`))
            .join("\n")

    lines.push(`  ${JSON.stringify(key)}: ${serializedValue},`)
  }

  lines.push("}")
  lines.push("")
  return lines.join("\n")
}

async function writeNextraMetaFiles(manifestEntries) {
  const orderedEntries = manifestEntries
    .filter((entry) => entry.kind === "markdown" || entry.kind === "openapi")
    .slice()
    .sort((left, right) => left.order - right.order)

  const docsTree = new Map()

  function addMetaEntry(directory, key, value) {
    const list = docsTree.get(directory) ?? []
    if (!list.some((item) => item.key === key)) {
      list.push({ key, value })
      docsTree.set(directory, list)
    }
  }

  addMetaEntry("", "index", "Overview")

  for (const entry of orderedEntries) {
    const relativePath = entry.kind === "openapi" ? "openapi" : entry.sourcePath.replace(/\.md$/i, "")
    const segments = relativePath.split("/")
    const fileSlug = segments[segments.length - 1]
    const parentDir = segments.slice(0, -1).join("/")

    addMetaEntry(parentDir, fileSlug, entry.title)

    for (let i = 1; i < segments.length; i += 1) {
      const directory = segments.slice(0, i).join("/")
      const directoryParent = segments.slice(0, i - 1).join("/")
      addMetaEntry(directoryParent, segments[i - 1], toTitleCase(segments[i - 1]))
      if (!docsTree.has(directory)) {
        docsTree.set(directory, [])
      }
    }
  }

  for (const [directory, entries] of docsTree.entries()) {
    const targetDir = directory ? path.join(nextraVersionRoot, directory) : nextraVersionRoot
    await ensureDir(targetDir)

    const metaObject = new Map(entries.map((item) => [item.key, item.value]))
    await fs.writeFile(path.join(targetDir, "_meta.js"), metaToJs(metaObject), "utf8")
  }

  const rootMeta = new Map([
    ["index", { title: "Versions", display: "hidden" }],
    [CURRENT_VERSION, `${CURRENT_VERSION} (latest)`],
  ])

  await ensureDir(nextraContentRoot)
  await fs.writeFile(path.join(nextraContentRoot, "_meta.js"), metaToJs(rootMeta), "utf8")
}

function buildVersionLanding(entries) {
  const sectionFirstPages = new Map()

  for (const entry of entries) {
    if (entry.kind !== "markdown") {
      continue
    }

    if (!sectionFirstPages.has(entry.sectionTitle)) {
      sectionFirstPages.set(entry.sectionTitle, entry)
    }
  }

  const lines = [
    `# deAPI Documentation (${CURRENT_VERSION})`,
    "",
    "This version is generated from the live deAPI documentation index.",
    "",
    "## Sections",
    "",
  ]

  for (const [sectionTitle, entry] of sectionFirstPages.entries()) {
    lines.push(`- [${sectionTitle}](${entry.routePath})`)
  }

  lines.push("", "---", "", "Generated by `pnpm docs:sync:deapi`.", "")
  return lines.join("\n")
}

async function writeNextraContent(manifestEntries, markdownByPath, openapiText, docsPathSet) {
  await fs.rm(nextraVersionRoot, { recursive: true, force: true })
  await ensureDir(nextraVersionRoot)

  for (const entry of manifestEntries) {
    if (entry.kind !== "markdown") {
      continue
    }

    const source = markdownByPath.get(entry.sourcePath)
    if (!source) {
      throw new Error(`Missing markdown source for ${entry.sourcePath}`)
    }

    const transformed = toNextraMarkdown(source, entry.sourcePath, docsPathSet)
    const targetRelativePath = entry.sourcePath.replace(/\.md$/i, ".mdx")
    const targetPath = path.join(nextraVersionRoot, targetRelativePath)
    await ensureDir(path.dirname(targetPath))
    await fs.writeFile(targetPath, transformed, "utf8")
  }

  const openapiPretty = (() => {
    try {
      return JSON.stringify(JSON.parse(openapiText), null, 2)
    } catch {
      return openapiText
    }
  })()

  const openapiPage = [
    "# OpenAPI",
    "",
    "```json",
    openapiPretty,
    "```",
    "",
  ].join("\n")

  await fs.writeFile(path.join(nextraVersionRoot, "openapi.mdx"), openapiPage, "utf8")

  const versionLanding = buildVersionLanding(manifestEntries)
  await fs.writeFile(path.join(nextraVersionRoot, "index.mdx"), versionLanding, "utf8")

  const rootLanding = [
    "# deAPI Docs Versions",
    "",
    `- [${CURRENT_VERSION} (latest)](/docs/${CURRENT_VERSION})`,
    "",
  ].join("\n")

  await fs.writeFile(path.join(nextraContentRoot, "index.mdx"), rootLanding, "utf8")

  await writeNextraMetaFiles(manifestEntries)
}

async function writeContentEntries(entries) {
  const manifestEntries = []
  const markdownByPath = new Map()
  let openapiText = ""

  for (const [order, entry] of entries.entries()) {
    const destinationPath = path.join(articlesRoot, entry.sourcePath)
    await ensureDir(path.dirname(destinationPath))

    if (entry.sourcePath.endsWith(".json")) {
      const content = await fetchBuffer(entry.url)
      await fs.writeFile(destinationPath, content)
      openapiText = content.toString("utf8")
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

  await writeNextraContent(manifestEntries, markdownByPath, openapiText, docsPathSet)

  return manifestEntries
}

async function main() {
  await ensureDir(outputRoot)
  await ensureDir(articlesRoot)
  await ensureDir(nextraContentRoot)

  const indexText = await fetchText(INDEX_URL)
  await fs.writeFile(path.join(outputRoot, "llms.txt"), indexText, "utf8")

  const entries = parseEntries(indexText)

  if (entries.length === 0) {
    throw new Error("No entries discovered in llms.txt")
  }

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
  console.log(`Nextra output: ${nextraVersionRoot}`)
}

await main()
