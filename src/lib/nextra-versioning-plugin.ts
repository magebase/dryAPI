type VersioningPluginOptions = {
  currentVersion?: string
}

type MdxNode = {
  type?: string
  url?: string
  children?: MdxNode[]
}

function isExternalUrl(url: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")
}

function normalizeDocsUrl(url: string, currentVersion: string): string {
  if (!url || url.startsWith("#") || isExternalUrl(url)) {
    return url
  }

  if (url.startsWith("/docs/")) {
    if (url.startsWith(`/docs/${currentVersion}/`)) {
      return url
    }

    return url.replace(/^\/docs\//, `/docs/${currentVersion}/`)
  }

  if (url.startsWith("/")) {
    return `/docs/${currentVersion}${url}`
  }

  return url
}

function walkAndRewriteLinks(node: MdxNode, currentVersion: string): void {
  if ((node.type === "link" || node.type === "image") && typeof node.url === "string") {
    node.url = normalizeDocsUrl(node.url, currentVersion)
  }

  if (!node.children || node.children.length === 0) {
    return
  }

  for (const child of node.children) {
    walkAndRewriteLinks(child, currentVersion)
  }
}

export function remarkNextraVersioning(options: VersioningPluginOptions = {}) {
  const currentVersion = options.currentVersion ?? "v1"

  return (tree: MdxNode) => {
    walkAndRewriteLinks(tree, currentVersion)
  }
}
