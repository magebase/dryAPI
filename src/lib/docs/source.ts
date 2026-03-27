import type { ReactNode } from "react"

import { defineI18n } from "fumadocs-core/i18n"
import { loader } from "fumadocs-core/source"
import { openapiPlugin } from "fumadocs-openapi/server"
import { docs } from "collections/server"

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n"

const CURRENT_DOCS_VERSION = "v1"

export const docsI18n = defineI18n({
  languages: SUPPORTED_LOCALES,
  defaultLanguage: DEFAULT_LOCALE,
  fallbackLanguage: DEFAULT_LOCALE,
  hideLocale: "default-locale",
  parser: "none",
})

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  i18n: docsI18n,
  plugins: [openapiPlugin()],
})

type PageTreeId = {
  $id?: string
}

type PageTreeItem = PageTreeId & {
  type: "page"
  name: ReactNode
  url: string
  external?: boolean
  description?: ReactNode
  icon?: ReactNode
  $ref?: {
    file: string
  }
}

type PageTreeSeparator = PageTreeId & {
  type: "separator"
  name?: ReactNode
  icon?: ReactNode
}

type PageTreeFolder = PageTreeId & {
  type: "folder"
  name: ReactNode
  description?: ReactNode
  root?: boolean
  defaultOpen?: boolean
  collapsible?: boolean
  index?: PageTreeItem
  icon?: ReactNode
  children: PageTreeNode[]
  $ref?: {
    metaFile?: string
  }
}

type PageTreeRoot = PageTreeId & {
  name: ReactNode
  children: PageTreeNode[]
  fallback?: PageTreeRoot
}

type PageTreeNode = PageTreeItem | PageTreeSeparator | PageTreeFolder

const GET_STARTED_ORDER = [
  "introduction",
  "quickstart",
  "models",
  "pricing",
  "architecture-and-security",
  "limits-and-quotas",
] as const

const EXECUTION_ORDER = [
  "execution-modes-and-http-queue",
  "webhooks",
  "websockets",
  "mcp-server",
  "n8n-integration",
  "n8n-dryapi-node",
] as const

const OTHER_ORDER = [
  "sdks-and-integrations",
  "payment-methods",
  "faq-frequently-asked-questions",
  "support-and-contact",
] as const

const API_METHOD_BY_KEY: Record<string, string> = {
  "generation/audio-to-video": "POST",
  "generation/audio-to-video-price": "POST",
  "generation/image-to-video": "POST",
  "generation/image-to-video-price": "POST",
  "generation/text-to-embedding": "POST",
  "generation/text-to-embedding-price": "POST",
  "generation/text-to-image": "POST",
  "generation/text-to-image-price": "POST",
  "generation/text-to-music": "POST",
  "generation/text-to-music-price": "POST",
  "generation/text-to-speech": "POST",
  "generation/text-to-speech-price": "POST",
  "generation/text-to-video": "POST",
  "generation/text-to-video-price": "POST",
  "transformation/background-removal": "POST",
  "transformation/background-removal-price": "POST",
  "transformation/image-to-image": "POST",
  "transformation/image-to-image-price": "POST",
  "transformation/image-upscale": "POST",
  "transformation/image-upscale-price": "POST",
  "analysis/audio-to-text-spaces": "POST",
  "analysis/audio-to-text-spaces-price": "POST",
  "analysis/image-to-text": "POST",
  "analysis/image-to-text-price": "POST",
  "analysis/upload-audio-file": "POST",
  "analysis/upload-audio-file-price": "POST",
  "analysis/upload-video-file": "POST",
  "analysis/upload-video-file-price": "POST",
  "analysis/video-to-text": "POST",
  "analysis/video-to-text-price": "POST",
  "prompt-enhancement/image-prompt-booster": "POST",
  "prompt-enhancement/image-prompt-booster-price": "POST",
  "prompt-enhancement/image-to-image-prompt-booster": "POST",
  "prompt-enhancement/image-to-image-prompt-booster-price": "POST",
  "prompt-enhancement/sample-prompts": "POST",
  "prompt-enhancement/sample-prompts-price": "POST",
  "prompt-enhancement/speech-prompt-booster": "POST",
  "prompt-enhancement/speech-prompt-booster-price": "POST",
  "prompt-enhancement/video-prompt-booster": "POST",
  "prompt-enhancement/video-prompt-booster-price": "POST",
  "utilities/check-balance": "GET",
  "utilities/get-results": "GET",
  "utilities/model-selection": "GET",
}

const OPENAPI_ROUTE_ORDER = [
  "generation/text-to-image",
  "generation/text-to-image-price",
  "generation/text-to-video",
  "generation/text-to-video-price",
  "generation/image-to-video",
  "generation/image-to-video-price",
  "generation/audio-to-video",
  "generation/audio-to-video-price",
  "generation/text-to-speech",
  "generation/text-to-speech-price",
  "generation/text-to-music",
  "generation/text-to-music-price",
  "generation/text-to-embedding",
  "generation/text-to-embedding-price",
  "transformation/image-to-image",
  "transformation/image-to-image-price",
  "transformation/background-removal",
  "transformation/background-removal-price",
  "transformation/image-upscale",
  "transformation/image-upscale-price",
] as const

function isPageTreeFolder(node: PageTreeNode | PageTreeRoot | undefined): node is PageTreeFolder {
  return typeof node === "object" && node !== null && "type" in node && node.type === "folder"
}

function pathFromUrl(url?: string) {
  if (!url) return undefined

  const normalized = url.startsWith("http") ? new URL(url).pathname : url
  return normalized.replace(/\/+$/, "") || "/"
}

function keyFromName(name?: ReactNode) {
  if (typeof name !== "string") return undefined
  return name.toLowerCase().trim().replace(/\s+/g, "-")
}

function keyFromNode(node: PageTreeNode) {
  return keyFromPath("url" in node ? pathFromUrl(node.url) : undefined) ?? keyFromName(node.name)
}

function keyFromPath(pathname?: string) {
  if (!pathname) return undefined
  const segments = pathname.split("/").filter(Boolean)
  const apiIndex = segments.findIndex((segment) => segment === "api")

  if (apiIndex === -1 || apiIndex === segments.length - 1) {
    return segments.at(-1)
  }

  return segments.slice(apiIndex + 1).join("/")
}

function reorderChildrenByKeys(children: PageTreeNode[] | undefined, orderedKeys: readonly string[]) {
  if (!children || !Array.isArray(children)) return []
  const map = new Map<string, PageTreeNode>()

  for (const child of children) {
    const key = keyFromNode(child)
    if (key) map.set(key, child)
  }

  const ordered: PageTreeNode[] = []
  for (const key of orderedKeys) {
    const node = map.get(key)
    if (node) ordered.push(node)
  }

  for (const child of children) {
    if (!ordered.includes(child)) {
      ordered.push(child)
    }
  }

  return ordered
}

function findChildByKey(children: PageTreeNode[] | undefined, key: string): PageTreeNode | undefined {
  if (!children || !Array.isArray(children)) return undefined
  return children.find((child) => keyFromNode(child) === key)
}

function withApiMethodLabels(nodes: PageTreeNode[] | undefined): PageTreeNode[] {
  if (!nodes || !Array.isArray(nodes)) return []
  return nodes.map((node) => {
    if (isPageTreeFolder(node) && node.children && Array.isArray(node.children) && node.children.length) {
      return {
        ...node,
        children: withApiMethodLabels(node.children),
      }
    }

    const key = keyFromNode(node)
    if (!key || key === "overview" || key === "errors") {
      return node
    }

    const method = API_METHOD_BY_KEY[key]
    if (!method || typeof node.name !== "string") {
      return node
    }

    if (node.name.startsWith(`${method} `)) {
      return node
    }

    return {
      ...node,
      name: `${method} ${node.name}`,
    }
  })
}

function createFolderNode(name: string, children: PageTreeNode[]) {
  return {
    type: "folder" as const,
    name,
    children: Array.isArray(children) ? children : [],
  } satisfies PageTreeNode
}

function normalizeApiChildren(children: PageTreeNode[] | undefined) {
  if (!children || !Array.isArray(children)) return []
  const flattened: PageTreeNode[] = []

  for (const child of children) {
    const childKey = keyFromNode(child)
    if ((childKey === "generation" || childKey === "transformation") && isPageTreeFolder(child) && Array.isArray(child.children) && child.children.length) {
      flattened.push(...child.children)
      continue
    }

    flattened.push(child)
  }

  const prioritizedKeys = ["overview", "errors", ...OPENAPI_ROUTE_ORDER]
  const prioritized = new Map<string, PageTreeNode>()

  for (const node of flattened) {
    const key = keyFromNode(node)
    if (key && prioritizedKeys.includes(key as (typeof OPENAPI_ROUTE_ORDER)[number] | "overview" | "errors")) {
      prioritized.set(key, node)
    }
  }

  const ordered: PageTreeNode[] = []
  for (const key of prioritizedKeys) {
    const node = prioritized.get(key)
    if (node) ordered.push(node)
  }

  for (const node of flattened) {
    if (!ordered.includes(node)) {
      ordered.push(node)
    }
  }

  const normalized = withApiMethodLabels(ordered)
  return Array.isArray(normalized) ? normalized : []
}

function normalizeVersionTree(versionNode: PageTreeFolder): PageTreeFolder {
  const children = Array.isArray(versionNode.children) ? versionNode.children : []
  const apiIndex = children.findIndex((child) => keyFromNode(child) === "api")

  if (apiIndex === -1) {
    return versionNode
  }

  const apiNode = children[apiIndex]
  if (!isPageTreeFolder(apiNode) || !Array.isArray(apiNode.children)) {
    return versionNode
  }

  const apiChildren = apiNode.children
  const extracted: PageTreeNode[] = []
  const keptVersionChildren: PageTreeNode[] = []

  for (const child of children) {
    const key = keyFromNode(child)
    if (key === "openapi" || key === "api-reference") {
      extracted.push(child)
      continue
    }

    keptVersionChildren.push(child)
  }

  const normalizedApiChildren = normalizeApiChildren(apiChildren)
  for (const node of extracted) {
    if (!normalizedApiChildren.some((existing) => "url" in existing && "url" in node && existing.url === node.url)) {
      normalizedApiChildren.push(node)
    }
  }

  const normalizedApiNode: PageTreeNode = {
    ...apiNode,
    children: Array.isArray(normalizedApiChildren) ? normalizedApiChildren : [],
  }

  return {
    ...versionNode,
    children: keptVersionChildren.map((child) => (keyFromNode(child) === "api" ? normalizedApiNode : child)),
  }
}

export function getDocsPageTree(locale: string): PageTreeRoot {
  const tree = source.getPageTree(locale) as unknown as PageTreeRoot
  if (!tree || !Array.isArray(tree.children)) {
    return tree || { children: [] }
  }

  const versionPath = `/${locale === DEFAULT_LOCALE ? "" : `${locale}/`}docs/${CURRENT_DOCS_VERSION}`.replace(/\/\//g, "/")

  const versionNode = tree.children.find((child) => {
    const name = typeof child.name === "string" ? child.name.toLowerCase() : undefined
    if (name === CURRENT_DOCS_VERSION || ("url" in child && child.url === versionPath)) {
      return true
    }

    return isPageTreeFolder(child) && Array.isArray(child.children)
      ? child.children.some((nested) => "url" in nested && nested.url === versionPath)
      : false
  })

  if (!versionNode || !isPageTreeFolder(versionNode)) {
    return tree
  }

  const normalizedVersionNode = normalizeVersionTree(versionNode)
  const topLevelChildren = normalizedVersionNode.children ?? []

  const getStartedChildren = reorderChildrenByKeys(topLevelChildren, GET_STARTED_ORDER).filter((child) => {
    const key = keyFromNode(child)
    return Boolean(key && GET_STARTED_ORDER.includes(key as (typeof GET_STARTED_ORDER)[number]))
  })

  const executionNode = findChildByKey(topLevelChildren, "execution-modes-and-integrations")
  const executionChildren = reorderChildrenByKeys(isPageTreeFolder(executionNode) ? executionNode.children : [], EXECUTION_ORDER).filter((child) => {
    const key = keyFromNode(child)
    return Boolean(key && EXECUTION_ORDER.includes(key as (typeof EXECUTION_ORDER)[number]))
  })

  const apiNode = findChildByKey(topLevelChildren, "api")
  const otherNode = findChildByKey(topLevelChildren, "other")
  const otherChildren = reorderChildrenByKeys(isPageTreeFolder(otherNode) ? otherNode.children : [], OTHER_ORDER).filter((child) => {
    const key = keyFromNode(child)
    return Boolean(key && OTHER_ORDER.includes(key as (typeof OTHER_ORDER)[number]))
  })

  const rootChildren: PageTreeNode[] = []

  if (getStartedChildren.length) {
    rootChildren.push(createFolderNode("Get started", getStartedChildren))
  }

  if (executionNode && isPageTreeFolder(executionNode)) {
    rootChildren.push({
      ...executionNode,
      name: "Execution Modes & Integrations",
      children: executionChildren,
    })
  }

  if (apiNode && isPageTreeFolder(apiNode)) {
    rootChildren.push({
      ...apiNode,
      name: "API",
      children: Array.isArray(apiNode.children) ? apiNode.children : [],
    })
  }

  if (otherNode && isPageTreeFolder(otherNode)) {
    rootChildren.push({
      ...otherNode,
      name: "Other",
      children: otherChildren,
    })
  }

  return {
    ...tree,
    children: rootChildren,
  }
}