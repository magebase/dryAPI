import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promises as fs } from 'node:fs'

type FooterLink = {
  label: string
  href: string
}

type FooterColumn = {
  title: string
  links: FooterLink[]
}

type SiteConfig = {
  footer: {
    columns: FooterColumn[]
  }
}

const CLOUDFLARE_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'
const SITE_CONFIG_PATH = path.join(process.cwd(), 'content', 'site', 'site-config.json')
const DEFAULT_LOOKBACK_DAYS = 30
const DEFAULT_TARGET_COLUMNS = ['RunPod Serverless Models', 'Popular AI API Articles', 'Popular by Use Case']

function isEntrypoint(): boolean {
  const argvPath = process.argv[1]
  if (!argvPath) {
    return false
  }

  return pathToFileURL(path.resolve(argvPath)).href === import.meta.url
}

async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) {
        continue
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
        continue
      }

      process.env[key] = trimmed.slice(separatorIndex + 1)
    }
  } catch {
    // Ignore missing env files.
  }
}

async function loadRuntimeEnv(): Promise<void> {
  await loadEnvFile(path.join(process.cwd(), '.env'))
  await loadEnvFile(path.join(process.cwd(), '.env.local'))
}

function requireOneOfEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  throw new Error(`One of ${keys.join(' or ')} is required.`)
}

function readLookbackDays(): number {
  const raw = process.env['CF_PAGE_ANALYTICS_LOOKBACK_DAYS']?.trim()
  if (!raw) {
    return DEFAULT_LOOKBACK_DAYS
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error('CF_PAGE_ANALYTICS_LOOKBACK_DAYS must be an integer between 1 and 365.')
  }

  return parsed
}

function readTargetColumns(): string[] {
  const raw = process.env['CF_PAGE_ANALYTICS_TARGET_COLUMNS']?.trim()
  if (!raw) {
    return DEFAULT_TARGET_COLUMNS
  }

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (parsed.length === 0) {
    throw new Error('CF_PAGE_ANALYTICS_TARGET_COLUMNS is set but contains no valid column titles.')
  }

  return parsed
}

function normalizeBlogPath(href: string): string | null {
  if (!href.startsWith('/blog/')) {
    return null
  }

  return href.replace(/\/+$/, '')
}

function buildPathViewsQuery(args: {
  zoneId: string
  startIso: string
  endIso: string
  paths: string[]
}): string {
  if (args.paths.length === 0) {
    throw new Error('No blog paths were provided for analytics ranking.')
  }

  const aliasedQueries = args.paths
    .map(
      (blogPath, index) => `
      p${index}: httpRequestsAdaptiveGroups(
        limit: 1
        filter: {
          datetime_geq: ${JSON.stringify(args.startIso)}
          datetime_lt: ${JSON.stringify(args.endIso)}
          clientRequestPath: ${JSON.stringify(blogPath)}
        }
      ) {
        count
      }`,
    )
    .join('\n')

  return `
    query FooterBlogPathViews {
      viewer {
        zones(filter: { zoneTag: ${JSON.stringify(args.zoneId)} }) {
          ${aliasedQueries}
        }
      }
    }
  `
}

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected non-object response from Cloudflare GraphQL API.')
  }

  return value as Record<string, unknown>
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  throw new Error(`Unexpected count value from GraphQL API: ${String(value)}`)
}

async function fetchPathViews(args: {
  apiToken: string
  zoneId: string
  startIso: string
  endIso: string
  paths: string[]
}): Promise<Map<string, number>> {
  const query = buildPathViewsQuery({
    zoneId: args.zoneId,
    startIso: args.startIso,
    endIso: args.endIso,
    paths: args.paths,
  })

  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL request failed with status ${response.status}.`)
  }

  const payload = toObjectRecord(await response.json())
  if (Array.isArray(payload['errors']) && payload['errors'].length > 0) {
    throw new Error(`Cloudflare GraphQL returned errors: ${JSON.stringify(payload['errors'])}`)
  }

  const data = toObjectRecord(payload['data'])
  const viewer = toObjectRecord(data['viewer'])
  const zones = viewer['zones']

  if (!Array.isArray(zones) || zones.length === 0) {
    throw new Error('Cloudflare GraphQL returned no zones for the provided zone ID.')
  }

  const zoneData = toObjectRecord(zones[0])
  const pathViews = new Map<string, number>()

  args.paths.forEach((blogPath, index) => {
    const alias = `p${index}`
    const groups = zoneData[alias]

    if (!Array.isArray(groups) || groups.length === 0) {
      pathViews.set(blogPath, 0)
      return
    }

    const firstGroup = toObjectRecord(groups[0])
    pathViews.set(blogPath, parseCount(firstGroup['count']))
  })

  return pathViews
}

export function reorderLinksByPageViews(links: FooterLink[], pathViews: ReadonlyMap<string, number>): FooterLink[] {
  return links
    .map((link, index) => {
      const path = normalizeBlogPath(link.href)
      const views = path ? pathViews.get(path) ?? 0 : -1
      return { link, index, views }
    })
    .sort((left, right) => {
      if (right.views !== left.views) {
        return right.views - left.views
      }

      return left.index - right.index
    })
    .map((entry) => entry.link)
}

function collectTargetBlogPaths(columns: FooterColumn[], targetColumnTitles: string[]): string[] {
  const titleSet = new Set(targetColumnTitles)
  const pathSet = new Set<string>()

  columns.forEach((column) => {
    if (!titleSet.has(column.title)) {
      return
    }

    column.links.forEach((link) => {
      const blogPath = normalizeBlogPath(link.href)
      if (blogPath) {
        pathSet.add(blogPath)
      }
    })
  })

  if (pathSet.size === 0) {
    throw new Error('No /blog/* links found in target footer columns.')
  }

  return [...pathSet]
}

function assertSiteConfig(value: unknown): SiteConfig {
  const objectValue = toObjectRecord(value)
  const footer = toObjectRecord(objectValue['footer'])

  if (!Array.isArray(footer['columns'])) {
    throw new Error('content/site/site-config.json is missing footer.columns array.')
  }

  return objectValue as SiteConfig
}

export async function sortFooterBlogLinksByPageAnalytics(): Promise<void> {
  await loadRuntimeEnv()

  const apiToken = requireOneOfEnv(['CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN'])
  const zoneId = requireOneOfEnv(['CF_ZONE_ID', 'CLOUDFLARE_ZONE_ID'])
  const lookbackDays = readLookbackDays()
  const targetColumns = readTargetColumns()

  const raw = await fs.readFile(SITE_CONFIG_PATH, 'utf8')
  const siteConfig = assertSiteConfig(JSON.parse(raw))

  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setUTCDate(endDate.getUTCDate() - lookbackDays)

  const blogPaths = collectTargetBlogPaths(siteConfig.footer.columns, targetColumns)
  const pathViews = await fetchPathViews({
    apiToken,
    zoneId,
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    paths: blogPaths,
  })

  siteConfig.footer.columns = siteConfig.footer.columns.map((column) => {
    if (!targetColumns.includes(column.title)) {
      return column
    }

    return {
      ...column,
      links: reorderLinksByPageViews(column.links, pathViews),
    }
  })

  await fs.writeFile(SITE_CONFIG_PATH, `${JSON.stringify(siteConfig, null, 2)}\n`, 'utf8')

  console.log(`[footer:sort] Updated footer blog ordering using Cloudflare Page Analytics for ${lookbackDays} days.`)
  console.log(`[footer:sort] Target columns: ${targetColumns.join(', ')}`)

  targetColumns.forEach((title) => {
    const column = siteConfig.footer.columns.find((entry) => entry.title === title)
    if (!column) {
      return
    }

    console.log(`\n[footer:sort] ${title}`)
    column.links.forEach((link, index) => {
      const blogPath = normalizeBlogPath(link.href)
      const views = blogPath ? pathViews.get(blogPath) ?? 0 : -1
      console.log(`  ${String(index + 1).padStart(2, ' ')}. ${link.label} (${views} requests)`)
    })
  })
}

if (isEntrypoint()) {
  sortFooterBlogLinksByPageAnalytics().catch((error) => {
    console.error(`[footer:sort] Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
