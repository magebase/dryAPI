"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Download,
  Gauge,
  MailPlus,
  RefreshCw,
  Send,
  ShieldAlert,
  Target,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  crmMailingListSchema,
  crmWorkflowDispatchSchema,
} from "@/lib/input-validation-schemas";
import type {
  CrmDashboardData,
  CrmLead,
  CrmLeadPriority,
} from "@/lib/crm-types";

type CrmDashboardProps = {
  initialData: CrmDashboardData;
};

type WorkflowDispatchResponse = {
  ok?: boolean;
  error?: string;
  instanceId?: string;
};

type MailingResponse = {
  ok?: boolean;
  error?: string;
};

const priorityBadgeVariant: Record<
  CrmLeadPriority,
  "default" | "secondary" | "outline" | "destructive"
> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const queuePalette = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function CrmDashboard({ initialData }: CrmDashboardProps) {
  const [data, setData] = useState<CrmDashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workflowKind, setWorkflowKind] = useState(
    initialData.workflowKinds[0] || "lead-scoring-and-tagging",
  );
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [selectedLeadNote, setSelectedLeadNote] = useState("");
  const [mailingForm, setMailingForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    company: "",
  });
  const [mailingStatus, setMailingStatus] = useState("");
  const workflowAutomationEnabled = data.features.workflowAutomationEnabled;
  const mailingListSyncEnabled = data.features.mailingListSyncEnabled;

  const generatedAt = useMemo(
    () =>
      new Date(data.generatedAt).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [data.generatedAt],
  );

  async function refreshDashboard() {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/crm/dashboard", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Dashboard refresh failed (${response.status})`);
      }

      const payload = (await response.json()) as CrmDashboardData;
      setData(payload);
      setWorkflowStatus("Dashboard refreshed.");
      toast.success("Dashboard refreshed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh dashboard.";
      setWorkflowStatus(message);
      toast.error("Refresh failed", {
        description: message,
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  function exportLeads(format: "csv" | "hubspot" | "salesforce" | "zoho") {
    const url = `/api/crm/export?format=${format}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Export started", {
      description: `Preparing ${format.toUpperCase()} export in a new tab.`,
    });
  }

  async function dispatchWorkflow(lead: CrmLead | null) {
    if (!workflowAutomationEnabled) {
      setWorkflowStatus("Workflow automation is disabled by env flag.");
      toast("Workflow automation disabled");
      return;
    }

    setWorkflowStatus("Dispatching workflow...");

    const payload = {
      leadId: lead?.id || null,
      leadEmail: lead?.email || null,
      leadName: lead?.name || null,
      leadPriority: lead?.priority || null,
      leadQueue: lead?.queue || null,
      note: selectedLeadNote.trim() || null,
      triggeredAt: new Date().toISOString(),
      source: "crm-dashboard",
    };

    const parsedWorkflow = crmWorkflowDispatchSchema.safeParse({
      kind: workflowKind,
      payload,
    });

    if (!parsedWorkflow.success) {
      const message =
        parsedWorkflow.error.issues[0]?.message || "Workflow dispatch failed.";
      setWorkflowStatus(message);
      toast.error("Workflow dispatch failed", {
        description: message,
      });
      return;
    }

    try {
      const response = await fetch("/api/crm/workflows/dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsedWorkflow.data),
      });

      const body = (await response
        .json()
        .catch(() => ({}))) as WorkflowDispatchResponse;

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error || `Workflow dispatch failed (${response.status})`,
        );
      }

      const instanceId = body.instanceId
        ? ` Instance: ${body.instanceId}.`
        : "";
      setWorkflowStatus(`Workflow dispatched successfully.${instanceId}`);
      toast.success("Workflow dispatched", {
        description: body.instanceId
          ? `Instance: ${body.instanceId}`
          : "The workflow run has started.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Workflow dispatch failed.";
      setWorkflowStatus(message);
      toast.error("Workflow dispatch failed", {
        description: message,
      });
    }
  }

  async function submitMailingList() {
    if (!mailingListSyncEnabled) {
      setMailingStatus("Mailing list sync is disabled by env flag.");
      toast("Mailing list sync disabled");
      return;
    }

    setMailingStatus("Syncing contact to mailing list...");

    const parsedMailingContact = crmMailingListSchema.safeParse({
      ...mailingForm,
      tags: ["crm", "dryapi"],
    });

    if (!parsedMailingContact.success) {
      const message =
        parsedMailingContact.error.issues[0]?.message ||
        "Unable to sync mailing list contact.";
      setMailingStatus(message);
      toast.error("Mailing list sync failed", {
        description: message,
      });
      return;
    }

    try {
      const response = await fetch("/api/crm/mailing-list", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsedMailingContact.data),
      });

      const body = (await response.json().catch(() => ({}))) as MailingResponse;

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error || `Mailing list sync failed (${response.status})`,
        );
      }

      setMailingStatus("Contact synced to Brevo list.");
      toast.success("Contact synced", {
        description: "The contact was added to the Brevo list.",
      });
      setMailingForm({
        email: "",
        firstName: "",
        lastName: "",
        company: "",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sync mailing list contact.";
      setMailingStatus(message);
      toast.error("Mailing list sync failed", {
        description: message,
      });
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(255,140,56,0.24),transparent_36%),radial-gradient(circle_at_86%_4%,rgba(84,148,255,0.24),transparent_34%),linear-gradient(180deg,#071120_0%,#0b1728_52%,#0f1d31_100%)] px-4 py-6 text-site-strong md:px-8 md:py-8">
      <section className="mx-auto w-full max-w-[1320px] space-y-6">
        <Card className="border-white/10 bg-white/5 text-site-strong shadow-[0_28px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#ff8b2b] text-black">CRM</Badge>
              <Badge variant="outline">crm.dryapi.dev</Badge>
              <Badge variant="outline">Updated {generatedAt}</Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight md:text-3xl">
              GenFix Revenue Console
            </CardTitle>
            <CardDescription className="max-w-3xl text-site-soft">
              Prioritized lead intelligence, export-ready pipeline data,
              workflow automation, chat-derived context, and marketing sync in
              one place.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                className="bg-[#ff8b2b] text-black hover:bg-[#ff9d4c]"
                onClick={() => exportLeads("csv")}
              >
                <Download className="size-4" />
                Export CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportLeads("hubspot")}
              >
                Export HubSpot
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportLeads("salesforce")}
              >
                Export Salesforce
              </Button>
              <Button variant="secondary" onClick={() => exportLeads("zoho")}>
                Export Zoho
              </Button>
              <Button onClick={() => void refreshDashboard()} variant="outline">
                <RefreshCw
                  className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Target}
            label="Total leads"
            value={String(data.metrics.totalLeads)}
            tone="warm"
          />
          <MetricCard
            icon={Gauge}
            label="Avg lead score"
            value={String(data.metrics.avgLeadScore)}
            tone="cool"
          />
          <MetricCard
            icon={Activity}
            label="High priority"
            value={String(data.metrics.highPriorityLeads)}
            tone="warm"
          />
          <MetricCard
            icon={ArrowUpRight}
            label="Last 24h"
            value={String(data.metrics.leadsLast24h)}
            tone="cool"
          />
          <MetricCard
            icon={ShieldAlert}
            label="Moderation blocks"
            value={String(data.metrics.moderationBlocks)}
            tone="neutral"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Demand Momentum</CardTitle>
              <CardDescription className="text-site-soft">
                New, qualified, and critical leads over the last 14 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                className="h-[300px] w-full"
                config={{
                  newLeads: {
                    label: "New Leads",
                    color: "hsl(var(--chart-1))",
                  },
                  qualifiedLeads: {
                    label: "Qualified",
                    color: "hsl(var(--chart-2))",
                  },
                  criticalLeads: {
                    label: "Critical",
                    color: "hsl(var(--chart-5))",
                  },
                }}
              >
                <AreaChart
                  data={data.trend}
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="crmLeadsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-newLeads)"
                        stopOpacity={0.65}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-newLeads)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient
                      id="crmQualifiedGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-qualifiedLeads)"
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-qualifiedLeads)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "rgba(255,255,255,0.28)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="newLeads"
                    stroke="var(--color-newLeads)"
                    fill="url(#crmLeadsGradient)"
                    strokeWidth={2.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="qualifiedLeads"
                    stroke="var(--color-qualifiedLeads)"
                    fill="url(#crmQualifiedGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="criticalLeads"
                    stroke="var(--color-criticalLeads)"
                    fill="none"
                    strokeWidth={1.8}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Queue Heatmap</CardTitle>
              <CardDescription className="text-site-soft">
                Volume and average quality by enquiry queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                className="h-[300px] w-full"
                config={{
                  count: { label: "Leads", color: "hsl(var(--chart-3))" },
                }}
              >
                <BarChart
                  data={data.queueBreakdown}
                  margin={{ left: 6, right: 6, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="queue" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[10, 10, 3, 3]}>
                    {data.queueBreakdown.map((entry, index) => (
                      <Cell
                        key={entry.queue}
                        fill={queuePalette[index % queuePalette.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Lead Prioritization Board</CardTitle>
              <CardDescription className="text-site-soft">
                High reward triage with instant workflow dispatch from each lead
                row.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.leads.slice(0, 10).map((lead) => (
                <article
                  key={lead.id}
                  className="rounded-lg border border-white/10 bg-black/25 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {lead.name}
                        </h3>
                        <Badge variant={priorityBadgeVariant[lead.priority]}>
                          {lead.priority}
                        </Badge>
                        <Badge variant="outline">{lead.queue}</Badge>
                        <Badge variant="outline">Score {lead.score}</Badge>
                      </div>
                      <p className="text-xs text-site-soft">
                        {lead.email} {lead.company ? `• ${lead.company}` : ""}
                      </p>
                      <p className="text-xs text-site-soft">
                        {lead.messagePreview || "No message preview."}
                      </p>
                    </div>
                    <Button
                      className="bg-white/10 hover:bg-white/20"
                      disabled={!workflowAutomationEnabled}
                      size="sm"
                      variant="secondary"
                      onClick={() => void dispatchWorkflow(lead)}
                    >
                      <Workflow className="size-4" />
                      Dispatch
                    </Button>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Workflow Orchestrator</CardTitle>
              <CardDescription className="text-site-soft">
                Cloudflare Workflows for scoring, follow-up, and KPI sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflowAutomationEnabled ? (
                <>
                  <label className="text-xs uppercase tracking-[0.14em] text-site-soft">
                    Flow kind
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#ff8b2b]"
                    value={workflowKind}
                    onChange={(event) => setWorkflowKind(event.target.value)}
                  >
                    {data.workflowKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs uppercase tracking-[0.14em] text-site-soft">
                    Optional run note
                  </label>
                  <Textarea
                    placeholder="Context for this automation run..."
                    className="min-h-[88px] border-white/15 bg-black/30 text-site-strong"
                    value={selectedLeadNote}
                    onChange={(event) =>
                      setSelectedLeadNote(event.target.value)
                    }
                  />
                  <Button
                    className="w-full bg-[#ff8b2b] text-black hover:bg-[#ff9d4c]"
                    onClick={() => void dispatchWorkflow(null)}
                  >
                    <Send className="size-4" />
                    Dispatch Workflow
                  </Button>
                </>
              ) : (
                <p className="text-xs text-site-soft">
                  Workflow automation is disabled by env configuration.
                </p>
              )}
              {workflowStatus ? (
                <p className="text-xs text-site-soft">{workflowStatus}</p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr_1fr]">
          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Conversation Timeline</CardTitle>
              <CardDescription className="text-site-soft">
                Lead/chat history synthesized for fast context handoff.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.chatHistory.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="rounded-md border border-white/10 bg-black/25 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">
                      {event.title}
                    </p>
                    <Badge
                      variant={
                        event.priority === "notice"
                          ? "outline"
                          : priorityBadgeVariant[event.priority]
                      }
                    >
                      {event.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-site-soft">{event.summary}</p>
                  <p className="mt-1 text-[11px] text-site-soft">
                    {new Date(event.at).toLocaleString("en-AU")} •{" "}
                    {event.channel}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Marketing List Sync</CardTitle>
              <CardDescription className="text-site-soft">
                Push high-value leads to Brevo in seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {mailingListSyncEnabled ? (
                <>
                  <Input
                    className="border-white/15 bg-black/30 text-site-strong"
                    placeholder="Email"
                    type="email"
                    value={mailingForm.email}
                    onChange={(event) =>
                      setMailingForm((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                  />
                  <Input
                    className="border-white/15 bg-black/30 text-site-strong"
                    placeholder="First name"
                    value={mailingForm.firstName}
                    onChange={(event) =>
                      setMailingForm((previous) => ({
                        ...previous,
                        firstName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    className="border-white/15 bg-black/30 text-site-strong"
                    placeholder="Last name"
                    value={mailingForm.lastName}
                    onChange={(event) =>
                      setMailingForm((previous) => ({
                        ...previous,
                        lastName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    className="border-white/15 bg-black/30 text-site-strong"
                    placeholder="Company"
                    value={mailingForm.company}
                    onChange={(event) =>
                      setMailingForm((previous) => ({
                        ...previous,
                        company: event.target.value,
                      }))
                    }
                  />
                  <Button
                    className="w-full bg-[#7cd6ff] text-[#052338] hover:bg-[#9be0ff]"
                    onClick={() => void submitMailingList()}
                  >
                    <MailPlus className="size-4" />
                    Sync To Brevo
                  </Button>
                </>
              ) : (
                <p className="text-xs text-site-soft">
                  Mailing list sync is disabled by env configuration.
                </p>
              )}
              {mailingStatus ? (
                <p className="text-xs text-site-soft">{mailingStatus}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-site-strong">
            <CardHeader>
              <CardTitle>Audience Snapshot</CardTitle>
              <CardDescription className="text-site-soft">
                Mailing and geo segmentation at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-site-soft">
                  Unique emails
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {data.marketing.uniqueEmails}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-site-soft">
                  Mailable leads
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {data.marketing.mailableLeads}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-site-soft">
                  Top states
                </p>
                <ul className="mt-2 space-y-1 text-xs text-site-soft">
                  {data.marketing.topStates.map((entry) => (
                    <li
                      key={entry.state}
                      className="flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" />
                        {entry.state}
                      </span>
                      <span>{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}

type MetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "warm" | "cool" | "neutral";
};

function MetricCard({ icon: Icon, label, value, tone }: MetricCardProps) {
  const toneClass =
    tone === "warm"
      ? "from-[#ff8b2b]/24 to-[#ff6524]/6"
      : tone === "cool"
        ? "from-[#7cd6ff]/24 to-[#6da4ff]/6"
        : "from-white/16 to-white/4";

  return (
    <Card
      className={`border-white/10 bg-gradient-to-br ${toneClass} text-site-strong`}
    >
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-site-soft">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-md border border-white/15 bg-black/20">
          <Icon className="size-5 text-site-soft" />
        </span>
      </CardContent>
    </Card>
  );
}
