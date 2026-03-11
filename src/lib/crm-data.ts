import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { scoreCrmLead } from "@/lib/crm-lead-score"
import {
  isCrmMailingListSyncEnabled,
  isCrmWorkflowAutomationsEnabled,
  resolveEnabledWorkflowKinds,
} from "@/lib/feature-flags"
import type {
  CrmDashboardData,
  CrmHistoryEvent,
  CrmLead,
  CrmQueueBreakdown,
  CrmTrendPoint,
} from "@/lib/crm-types"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T>() => Promise<D1PreparedResult<T>>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

type QuoteLeadRow = {
  id: string
  submission_type: string
  name: string
  email: string
  company: string
  phone: string
  state: string
  enquiry_type: string
  preferred_contact_method: string
  message: string
  source_path: string
  created_at: number | string
}

type ModerationRow = {
  id: string
  channel: string
  source_path: string
  reason: string
  model: string
  categories: string
  created_at: number | string
}

function toDbBinding(env: Record<string, unknown>): D1DatabaseLike | null {
  return ((env.QUOTE_DB ?? env.TINA_DB ?? null) as D1DatabaseLike | null) || null
}

function toTimestampMs(input: number | string): number {
  const value = typeof input === "string" ? Number(input) : input

  if (!Number.isFinite(value)) {
    return Date.now()
  }

  if (value < 10_000_000_000) {
    return Math.round(value * 1000)
  }

  return Math.round(value)
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

function toMessagePreview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.slice(0, 180)
}

function resolveLeadStatus(createdAtMs: number): "hot" | "warm" | "nurture" {
  const ageHours = (Date.now() - createdAtMs) / 3_600_000

  if (ageHours <= 8) {
    return "hot"
  }

  if (ageHours <= 48) {
    return "warm"
  }

  return "nurture"
}

async function safeQuery<T>(db: D1DatabaseLike, sql: string, bindValues: unknown[] = []): Promise<T[]> {
  try {
    const statement = bindValues.length > 0 ? db.prepare(sql).bind(...bindValues) : db.prepare(sql)
    const result = await statement.all<T>()
    return Array.isArray(result.results) ? result.results : []
  } catch {
    return []
  }
}

async function readSourceRows(db: D1DatabaseLike): Promise<{ leads: QuoteLeadRow[]; moderation: ModerationRow[] }> {
  const [leads, moderation] = await Promise.all([
    safeQuery<QuoteLeadRow>(
      db,
      `
        SELECT
          id,
          submission_type,
          name,
          email,
          company,
          phone,
          state,
          enquiry_type,
          preferred_contact_method,
          message,
          source_path,
          created_at
        FROM quote_requests
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [350]
    ),
    safeQuery<ModerationRow>(
      db,
      `
        SELECT
          id,
          channel,
          source_path,
          reason,
          model,
          categories,
          created_at
        FROM moderation_rejections
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [120]
    ),
  ])

  return { leads, moderation }
}

function buildTrend(leads: CrmLead[]): CrmTrendPoint[] {
  const dayMs = 24 * 60 * 60 * 1000
  const buckets = new Map<string, CrmTrendPoint>()

  for (let index = 13; index >= 0; index -= 1) {
    const now = new Date(Date.now() - index * dayMs)
    const day = now.toISOString().slice(0, 10)
    buckets.set(day, {
      day,
      label: now.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
      newLeads: 0,
      qualifiedLeads: 0,
      criticalLeads: 0,
    })
  }

  for (const lead of leads) {
    const day = lead.createdAt.slice(0, 10)
    const bucket = buckets.get(day)

    if (!bucket) {
      continue
    }

    bucket.newLeads += 1
    if (lead.score >= 65) {
      bucket.qualifiedLeads += 1
    }
    if (lead.priority === "critical") {
      bucket.criticalLeads += 1
    }
  }

  return Array.from(buckets.values())
}

function buildQueueBreakdown(leads: CrmLead[]): CrmQueueBreakdown[] {
  const grouped = new Map<string, { count: number; scoreTotal: number }>()

  for (const lead of leads) {
    const current = grouped.get(lead.queue) || { count: 0, scoreTotal: 0 }
    current.count += 1
    current.scoreTotal += lead.score
    grouped.set(lead.queue, current)
  }

  return Array.from(grouped.entries())
    .map(([queue, stats]) => ({
      queue,
      count: stats.count,
      avgScore: stats.count > 0 ? Math.round(stats.scoreTotal / stats.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function buildChatHistory(leads: CrmLead[], moderation: ModerationRow[]): CrmHistoryEvent[] {
  const leadEvents: CrmHistoryEvent[] = leads.slice(0, 14).map((lead) => ({
    id: `lead-${lead.id}`,
    at: lead.createdAt,
    channel: lead.submissionType,
    type: "lead",
    title: `${lead.name} (${lead.queue})`,
    summary: lead.messagePreview,
    priority: lead.priority,
  }))

  const moderationEvents: CrmHistoryEvent[] = moderation.slice(0, 8).map((entry) => {
    const categories = entry.categories
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    return {
      id: `moderation-${entry.id}`,
      at: toIsoString(toTimestampMs(entry.created_at)),
      channel: entry.channel,
      type: "moderation",
      title: `Moderation block (${entry.channel})`,
      summary:
        categories.length > 0
          ? `${entry.reason} Categories: ${categories.join(", ")}`
          : entry.reason,
      priority: "notice",
    }
  })

  return [...leadEvents, ...moderationEvents]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 20)
}

function buildMarketingSnapshot(leads: CrmLead[]) {
  const uniqueEmails = new Set<string>()
  const stateCount = new Map<string, number>()

  for (const lead of leads) {
    if (lead.email) {
      uniqueEmails.add(lead.email.toLowerCase())
    }

    const state = (lead.state || "Unknown").trim() || "Unknown"
    stateCount.set(state, (stateCount.get(state) || 0) + 1)
  }

  return {
    uniqueEmails: uniqueEmails.size,
    mailableLeads: leads.filter((lead) => lead.email.length > 0).length,
    topStates: Array.from(stateCount.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}

export async function getCrmDashboardData(): Promise<CrmDashboardData> {
  let db: D1DatabaseLike | null = null

  try {
    const { env } = await getCloudflareContext({ async: true })
    db = toDbBinding(env as Record<string, unknown>)
  } catch {
    db = null
  }

  const sourceRows = db
    ? await readSourceRows(db)
    : {
        leads: [],
        moderation: [],
      }

  const leads: CrmLead[] = sourceRows.leads.map((lead) => {
    const createdAtMs = toTimestampMs(lead.created_at)
    const scored = scoreCrmLead({
      enquiryType: lead.enquiry_type,
      message: lead.message,
      company: lead.company,
      phone: lead.phone,
      preferredContactMethod: lead.preferred_contact_method,
      sourcePath: lead.source_path,
    })

    return {
      id: lead.id,
      createdAt: toIsoString(createdAtMs),
      submissionType: lead.submission_type || "contact",
      name: lead.name,
      email: lead.email,
      company: lead.company || "",
      phone: lead.phone || "",
      state: lead.state || "",
      sourcePath: lead.source_path || "/",
      enquiryType: lead.enquiry_type || "",
      preferredContactMethod: lead.preferred_contact_method || "",
      messagePreview: toMessagePreview(lead.message || ""),
      score: scored.score,
      priority: scored.priority,
      queue: scored.queue,
      tags: scored.tags,
      status: resolveLeadStatus(createdAtMs),
    }
  })

  const highPriorityLeads = leads.filter((lead) => lead.priority === "critical" || lead.priority === "high")
  const trend = buildTrend(leads)
  const queueBreakdown = buildQueueBreakdown(leads)
  const chatHistory = buildChatHistory(leads, sourceRows.moderation)
  const marketing = buildMarketingSnapshot(leads)

  const leadsLast24h = leads.filter((lead) => Date.now() - new Date(lead.createdAt).getTime() <= 86_400_000).length
  const avgLeadScore =
    leads.length > 0
      ? Math.round(leads.reduce((accumulator, lead) => accumulator + lead.score, 0) / leads.length)
      : 0
  const workflowKinds = isCrmWorkflowAutomationsEnabled() ? resolveEnabledWorkflowKinds() : []
  const mailingListSyncEnabled = isCrmMailingListSyncEnabled()

  return {
    generatedAt: new Date().toISOString(),
    features: {
      workflowAutomationEnabled: workflowKinds.length > 0,
      mailingListSyncEnabled,
    },
    metrics: {
      totalLeads: leads.length,
      highPriorityLeads: highPriorityLeads.length,
      leadsLast24h,
      avgLeadScore,
      moderationBlocks: sourceRows.moderation.length,
    },
    trend,
    queueBreakdown,
    leads: leads.slice(0, 60),
    chatHistory,
    marketing,
    workflowKinds,
  }
}
