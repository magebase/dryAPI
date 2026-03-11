export type CrmLeadPriority = "critical" | "high" | "medium" | "low"

export type CrmLead = {
  id: string
  createdAt: string
  submissionType: string
  name: string
  email: string
  company: string
  phone: string
  state: string
  sourcePath: string
  enquiryType: string
  preferredContactMethod: string
  messagePreview: string
  score: number
  priority: CrmLeadPriority
  queue: string
  tags: string[]
  status: "hot" | "warm" | "nurture"
}

export type CrmTrendPoint = {
  day: string
  label: string
  newLeads: number
  qualifiedLeads: number
  criticalLeads: number
}

export type CrmQueueBreakdown = {
  queue: string
  count: number
  avgScore: number
}

export type CrmHistoryEvent = {
  id: string
  at: string
  channel: string
  type: "lead" | "moderation"
  title: string
  summary: string
  priority: CrmLeadPriority | "notice"
}

export type CrmDashboardData = {
  generatedAt: string
  features: {
    workflowAutomationEnabled: boolean
    mailingListSyncEnabled: boolean
  }
  metrics: {
    totalLeads: number
    highPriorityLeads: number
    leadsLast24h: number
    avgLeadScore: number
    moderationBlocks: number
  }
  trend: CrmTrendPoint[]
  queueBreakdown: CrmQueueBreakdown[]
  leads: CrmLead[]
  chatHistory: CrmHistoryEvent[]
  marketing: {
    uniqueEmails: number
    topStates: Array<{ state: string; count: number }>
    mailableLeads: number
  }
  workflowKinds: string[]
}
