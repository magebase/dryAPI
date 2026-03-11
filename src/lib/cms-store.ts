import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Redis } from "@upstash/redis"

import {
  cmsDataSchema,
  cmsSchemaByResource,
  type CmsData,
  type CmsResourceName,
} from "@/lib/cms-schema"

const contentFilePath = path.join(process.cwd(), "src", "data", "cms-content.json")
const redisContentKey = "cms:content:v1"

const redisClient =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

type ListOptions = {
  start: number
  end: number
  filter: Record<string, unknown>
}

type ListResult<TRecord> = {
  data: TRecord[]
  total: number
  start: number
  end: number
}

async function ensureContentFile() {
  try {
    await fs.access(contentFilePath)
  } catch {
    await fs.mkdir(path.dirname(contentFilePath), { recursive: true })
    const emptyContent: CmsData = {
      siteSettings: [],
      navigation: [],
      hero: [],
      services: [],
      projects: [],
      testimonials: [],
      contact: [],
    }
    await fs.writeFile(contentFilePath, JSON.stringify(emptyContent, null, 2), "utf8")
  }
}

async function readLocalCmsData(): Promise<CmsData> {
  await ensureContentFile()
  const raw = await fs.readFile(contentFilePath, "utf8")
  const parsed = JSON.parse(raw)
  return cmsDataSchema.parse(parsed)
}

async function writeLocalCmsData(data: CmsData) {
  await fs.writeFile(contentFilePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

export async function readCmsData(): Promise<CmsData> {
  if (!redisClient) {
    return readLocalCmsData()
  }

  const stored = await redisClient.get<CmsData | string>(redisContentKey)

  if (!stored) {
    const seed = await readLocalCmsData()
    await redisClient.set(redisContentKey, seed)
    return seed
  }

  const parsed = typeof stored === "string" ? JSON.parse(stored) : stored
  return cmsDataSchema.parse(parsed)
}

async function writeCmsData(data: CmsData) {
  if (redisClient) {
    await redisClient.set(redisContentKey, data)
    return
  }

  await writeLocalCmsData(data)
}

function applyFilter<TRecord extends Record<string, unknown>>(
  records: TRecord[],
  filter: Record<string, unknown>
) {
  const q = typeof filter.q === "string" ? filter.q.toLowerCase() : ""

  return records.filter((record) => {
    if (q) {
      const hasMatch = Object.values(record).some((value) =>
        typeof value === "string" ? value.toLowerCase().includes(q) : false
      )

      if (!hasMatch) {
        return false
      }
    }

    for (const [key, value] of Object.entries(filter)) {
      if (key === "q") {
        continue
      }

      if (record[key] !== value) {
        return false
      }
    }

    return true
  })
}

export function isCmsResourceName(resource: string): resource is CmsResourceName {
  return resource in cmsSchemaByResource
}

export async function listCmsResource<TResource extends CmsResourceName>(
  resource: TResource,
  options: ListOptions
): Promise<ListResult<CmsData[TResource][number]>> {
  const data = await readCmsData()
  const records = applyFilter(data[resource] as Record<string, unknown>[], options.filter)

  const total = records.length
  const start = Math.max(0, options.start)
  const end = Math.max(start, options.end)
  const page = records.slice(start, end + 1) as CmsData[TResource][number][]

  return {
    data: page,
    total,
    start,
    end: total === 0 ? 0 : Math.min(end, total - 1),
  }
}

export async function getCmsResourceRecord<TResource extends CmsResourceName>(
  resource: TResource,
  id: string
) {
  const data = await readCmsData()
  return data[resource].find((record) => String(record.id) === id) ?? null
}

export async function createCmsResourceRecord<TResource extends CmsResourceName>(
  resource: TResource,
  payload: Record<string, unknown>
) {
  const data = await readCmsData()
  const schema = cmsSchemaByResource[resource]

  const candidate = {
    ...payload,
    id: payload.id ? String(payload.id) : randomUUID(),
  }

  const validated = schema.parse(candidate)
  ;(data[resource] as typeof validated[]).push(validated)
  await writeCmsData(data)

  return validated
}

export async function updateCmsResourceRecord<TResource extends CmsResourceName>(
  resource: TResource,
  id: string,
  payload: Record<string, unknown>
) {
  const data = await readCmsData()
  const schema = cmsSchemaByResource[resource]
  const records = data[resource]
  const index = records.findIndex((record) => String(record.id) === id)

  if (index === -1) {
    return null
  }

  const candidate = {
    ...records[index],
    ...payload,
    id,
  }

  const validated = schema.parse(candidate)
  ;(records as typeof validated[])[index] = validated
  await writeCmsData(data)

  return validated
}

export async function deleteCmsResourceRecord<TResource extends CmsResourceName>(
  resource: TResource,
  id: string
) {
  const data = await readCmsData()
  const records = data[resource]
  const index = records.findIndex((record) => String(record.id) === id)

  if (index === -1) {
    return null
  }

  const [removed] = records.splice(index, 1)
  await writeCmsData(data)

  return removed
}
