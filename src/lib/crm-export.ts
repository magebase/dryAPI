import type { CrmLead } from "@/lib/crm-types"

type ExportFormat = "csv" | "hubspot" | "salesforce" | "zoho"

function csvEscape(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim()

  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }

  return normalized
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length <= 1) {
    return {
      firstName: parts[0] || fullName,
      lastName: "",
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export function exportLeads(leads: CrmLead[], format: ExportFormat): string {
  if (format === "csv") {
    const header = [
      "id",
      "createdAt",
      "name",
      "email",
      "company",
      "phone",
      "state",
      "queue",
      "priority",
      "score",
      "status",
      "sourcePath",
      "messagePreview",
    ]

    const rows = leads.map((lead) =>
      [
        lead.id,
        lead.createdAt,
        lead.name,
        lead.email,
        lead.company,
        lead.phone,
        lead.state,
        lead.queue,
        lead.priority,
        String(lead.score),
        lead.status,
        lead.sourcePath,
        lead.messagePreview,
      ]
        .map((value) => csvEscape(value))
        .join(",")
    )

    return [header.join(","), ...rows].join("\n")
  }

  if (format === "hubspot") {
    return JSON.stringify(
      leads.map((lead) => {
        const names = splitName(lead.name)

        return {
          email: lead.email,
          firstname: names.firstName,
          lastname: names.lastName,
          company: lead.company,
          phone: lead.phone,
          state: lead.state,
          lead_status: lead.status,
          lead_priority: lead.priority,
          lead_score: lead.score,
          lifecycle_stage: lead.priority === "critical" || lead.priority === "high" ? "opportunity" : "lead",
          notes: lead.messagePreview,
        }
      }),
      null,
      2
    )
  }

  if (format === "salesforce") {
    return JSON.stringify(
      leads.map((lead) => {
        const names = splitName(lead.name)

        return {
          FirstName: names.firstName,
          LastName: names.lastName || "Unknown",
          Company: lead.company || "Unknown",
          Email: lead.email,
          Phone: lead.phone,
          State: lead.state,
          LeadSource: "Website",
          Status: lead.priority === "critical" ? "Hot" : "Working",
          Rating: lead.priority === "critical" || lead.priority === "high" ? "Hot" : "Warm",
          Description: lead.messagePreview,
          GenFix_Lead_Score__c: lead.score,
          GenFix_Queue__c: lead.queue,
        }
      }),
      null,
      2
    )
  }

  return JSON.stringify(
    leads.map((lead) => ({
      Last_Name: lead.name,
      Company: lead.company || "Unknown",
      Email: lead.email,
      Phone: lead.phone,
      State: lead.state,
      Lead_Source: "Website",
      Lead_Status: lead.status,
      Description: lead.messagePreview,
      GenFix_Lead_Score: lead.score,
      GenFix_Lead_Priority: lead.priority,
      GenFix_Queue: lead.queue,
    })),
    null,
    2
  )
}
