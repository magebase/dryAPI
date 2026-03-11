import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

type ProFlowKind =
  | "lead-scoring-and-tagging"
  | "multi-channel-follow-up-sequencer"
  | "upsell-cross-sell-suggestions"
  | "review-aggregation-and-posting"
  | "payment-deposit-follow-up"
  | "lost-lead-recovery"
  | "event-webinar-reminders"
  | "vip-high-value-lead-alerts"
  | "abandoned-form-recovery"
  | "loyalty-repeat-client-automation"
  | "geo-targeted-promotions"
  | "internal-kpi-dashboard-sync";

type CanonicalFlowKind = "chat-escalation" | ProFlowKind;

type LegacyFlowKind =
  | "new-lead"
  | "booking-confirmation-reminders"
  | "review-reputation"
  | "lead-nurture"
  | "team-notifications"
  | "review-aggregation-and-alerting";

type Channel = "email" | "sms" | "whatsapp" | "telegram";

type Primitive = string | number | boolean | null;
type JsonValue = Primitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type SequenceStage = {
  delay: string;
  channel: Channel;
  message: string;
};

type LeadScoreResult = {
  score: number;
  tags: string[];
  priority: "high" | "normal";
};

type FlowRequest = {
  kind: CanonicalFlowKind;
  payload?: JsonObject;
};

interface Env {
  AUTOMATION_WORKFLOW: Workflow<FlowRequest>;
  AUTOMATION_API_TOKEN?: string;
  AUTOMATION_SCHEDULED_FLOWS?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
  BREVO_SMS_SENDER?: string;
  BREVO_ESCALATION_SMS_TO?: string;
  CHAT_ESCALATION_EMAIL_TO?: string;
  CRM_WEBHOOK_URL?: string;
  TEAM_NOTIFICATIONS_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
  KPI_WEBHOOK_URL?: string;
  REVIEW_AGGREGATION_WEBHOOK_URL?: string;
  PAYMENT_STATUS_WEBHOOK_URL?: string;
  RETARGETING_WEBHOOK_URL?: string;
  GEO_PROMOTIONS_WEBHOOK_URL?: string;
  WHATSAPP_WEBHOOK_URL?: string;
  WHATSAPP_WEBHOOK_TOKEN?: string;
  TELEGRAM_WEBHOOK_URL?: string;
  TELEGRAM_WEBHOOK_TOKEN?: string;
  LEAD_SCORING_HIGH_VALUE_THRESHOLD?: string;
}

const CANONICAL_FLOWS: CanonicalFlowKind[] = [
  "chat-escalation",
  "lead-scoring-and-tagging",
  "multi-channel-follow-up-sequencer",
  "upsell-cross-sell-suggestions",
  "review-aggregation-and-posting",
  "payment-deposit-follow-up",
  "lost-lead-recovery",
  "event-webinar-reminders",
  "vip-high-value-lead-alerts",
  "abandoned-form-recovery",
  "loyalty-repeat-client-automation",
  "geo-targeted-promotions",
  "internal-kpi-dashboard-sync",
];

const FLOW_ALIASES: Record<LegacyFlowKind, CanonicalFlowKind> = {
  "new-lead": "lead-scoring-and-tagging",
  "booking-confirmation-reminders": "event-webinar-reminders",
  "review-reputation": "review-aggregation-and-posting",
  "lead-nurture": "multi-channel-follow-up-sequencer",
  "team-notifications": "vip-high-value-lead-alerts",
  "review-aggregation-and-alerting": "review-aggregation-and-posting",
};

function asRecord(input: unknown): JsonObject {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as JsonObject;
}

function readString(input: JsonObject, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(input: JsonObject, key: string): number | null {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(input: JsonObject, key: string): boolean {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function readArray(input: JsonObject, key: string): JsonValue[] {
  const value = input[key];
  return Array.isArray(value) ? value : [];
}

function readStringArray(input: JsonObject, key: string): string[] {
  const value = input[key];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function ensureToken(request: Request, env: Env): boolean {
  const expected = env.AUTOMATION_API_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function resolveFlowKind(kind: string): CanonicalFlowKind | null {
  const normalized = kind.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if ((CANONICAL_FLOWS as string[]).includes(normalized)) {
    return normalized as CanonicalFlowKind;
  }

  if (normalized in FLOW_ALIASES) {
    return FLOW_ALIASES[normalized as LegacyFlowKind];
  }

  return null;
}

function parseScheduledFlowKinds(input: string | undefined): CanonicalFlowKind[] {
  if (!input) {
    return [];
  }

  const resolved = input
    .split(",")
    .map((item) => resolveFlowKind(item))
    .filter((item): item is CanonicalFlowKind => Boolean(item));

  return [...new Set(resolved)];
}

async function postJson(url: string, body: JsonObject, headers?: Record<string, string>): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Request failed (${response.status}): ${details}`);
  }
}

async function postToWebhook(
  url: string | undefined,
  payload: JsonObject,
  options?: { bearerToken?: string },
): Promise<boolean> {
  const target = url?.trim();
  if (!target) {
    return false;
  }

  const headers: Record<string, string> = {};
  if (options?.bearerToken?.trim()) {
    headers.authorization = `Bearer ${options.bearerToken.trim()}`;
  }

  await postJson(target, payload, headers);
  return true;
}

async function sendBrevoEmail(
  env: Env,
  subject: string,
  textContent: string,
  overrideTo?: string,
): Promise<boolean> {
  const apiKey = env.BREVO_API_KEY?.trim();
  const fromEmail = env.BREVO_FROM_EMAIL?.trim();
  const to = (overrideTo || env.CHAT_ESCALATION_EMAIL_TO || "").trim();
  if (!apiKey || !fromEmail || !to) {
    return false;
  }

  await postJson(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        email: fromEmail,
        name: env.BREVO_FROM_NAME?.trim() || "GenFix",
      },
      to: [{ email: to }],
      subject,
      textContent,
      tags: ["automation", "cloudflare-workflows"],
    },
    {
      "api-key": apiKey,
      accept: "application/json",
    },
  );

  return true;
}

async function sendBrevoSms(env: Env, content: string, overrideTo?: string): Promise<boolean> {
  const apiKey = env.BREVO_API_KEY?.trim();
  const sender = env.BREVO_SMS_SENDER?.trim();
  const recipient = (overrideTo || env.BREVO_ESCALATION_SMS_TO || "").trim();

  if (!apiKey || !sender || !recipient) {
    return false;
  }

  await postJson(
    "https://api.brevo.com/v3/transactionalSMS/sms",
    {
      sender,
      recipient,
      content: content.slice(0, 150),
      type: "transactional",
    },
    {
      "api-key": apiKey,
      accept: "application/json",
    },
  );

  return true;
}

async function sendChannelMessage(
  channel: Channel,
  env: Env,
  message: string,
  options?: { emailTo?: string; smsTo?: string; context?: JsonObject },
): Promise<boolean> {
  if (channel === "email") {
    return sendBrevoEmail(env, "GenFix follow-up", message, options?.emailTo);
  }

  if (channel === "sms") {
    return sendBrevoSms(env, message, options?.smsTo);
  }

  if (channel === "whatsapp") {
    return postToWebhook(
      env.WHATSAPP_WEBHOOK_URL,
      {
        channel,
        message,
        to: options?.smsTo || "",
        context: options?.context || {},
      },
      { bearerToken: env.WHATSAPP_WEBHOOK_TOKEN },
    );
  }

  return postToWebhook(
    env.TELEGRAM_WEBHOOK_URL,
    {
      channel,
      message,
      to: options?.smsTo || "",
      context: options?.context || {},
    },
    { bearerToken: env.TELEGRAM_WEBHOOK_TOKEN },
  );
}

function joinLines(lines: Array<string | undefined>): string {
  return lines.filter((line) => line && line.trim().length > 0).join("\n");
}

function scoreLead(payload: JsonObject, env: Env): LeadScoreResult {
  const location = readString(payload, "location").toLowerCase();
  const serviceType = readString(payload, "serviceType").toLowerCase();
  const urgency = readString(payload, "urgency").toLowerCase();
  const budget = readNumber(payload, "budget") || 0;
  const highValueThreshold = Number(env.LEAD_SCORING_HIGH_VALUE_THRESHOLD || "3000");

  let score = 0;
  const tags: string[] = [];

  if (urgency === "high" || urgency === "emergency") {
    score += 40;
    tags.push("urgent");
  }

  if (serviceType.includes("generator") || serviceType.includes("backup")) {
    score += 25;
    tags.push("core-service");
  }

  if (location.includes("brisbane") || location.includes("gold coast")) {
    score += 20;
    tags.push("in-service-area");
  }

  if (budget >= highValueThreshold) {
    score += 30;
    tags.push("high-budget");
  }

  const priority = score >= 70 ? "high" : "normal";
  if (priority === "high") {
    tags.push("priority");
  }

  return { score, tags, priority };
}

function parseSequenceStages(payload: JsonObject): SequenceStage[] {
  const input = readArray(payload, "sequence");
  if (input.length > 0) {
    const parsed = input
      .map((item) => asRecord(item))
      .map((item) => {
        const delay = readString(item, "delay");
        const channel = readString(item, "channel").toLowerCase() as Channel;
        const message = readString(item, "message");
        return { delay, channel, message };
      })
      .filter(
        (item): item is SequenceStage =>
          Boolean(item.delay) &&
          Boolean(item.message) &&
          ["email", "sms", "whatsapp", "telegram"].includes(item.channel),
      );

    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [
    {
      delay: "24 hours",
      channel: "email",
      message: "Quick follow-up from GenFix. Want us to lock in your quote?",
    },
    {
      delay: "36 hours",
      channel: "sms",
      message: "Checking in from GenFix. Reply and we can reserve a booking time.",
    },
    {
      delay: "48 hours",
      channel: "whatsapp",
      message: "Final follow-up: we can still help you with a tailored power solution.",
    },
  ];
}

function buildOwnerSummary(payload: JsonObject): string {
  const name = readString(payload, "name") || "Unknown lead";
  const email = readString(payload, "email") || "unknown@example.com";
  const phone = readString(payload, "phone") || "N/A";
  const serviceType = readString(payload, "serviceType") || "Not specified";

  return joinLines([
    "New lead activity",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Service type: ${serviceType}`,
  ]);
}

async function runChatEscalation(step: WorkflowStep, env: Env, payload: JsonObject): Promise<JsonObject> {
  const question = readString(payload, "question") || "Unknown question";
  const pagePath = readString(payload, "pagePath") || "/";
  const visitorId = readString(payload, "visitorId") || "anonymous";

  const emailSent = await step.do("notify escalation email", async () => {
    return sendBrevoEmail(
      env,
      `Chat escalation: ${question.slice(0, 72)}`,
      joinLines([
        "New chat escalation received.",
        `Question: ${question}`,
        `Page path: ${pagePath}`,
        `Visitor ID: ${visitorId}`,
      ]),
    );
  });

  const smsSent = await step.do("notify escalation sms", async () => {
    return sendBrevoSms(env, `GenFix chat escalation: ${question}`);
  });

  const crmSynced = await step.do("forward escalation to crm webhook", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "chat-escalation",
      source: "genfix-chatbot",
      question,
      pagePath,
      visitorId,
      requestedAt: new Date().toISOString(),
    });
  });

  return {
    template: "chat-escalation",
    emailSent,
    smsSent,
    crmSynced,
  };
}

async function runLeadScoringAndTagging(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const scored = await step.do("score and tag lead", async () => {
    return scoreLead(payload, env);
  });

  const ownerNotified = await step.do("notify owner with score", async () => {
    const summary = buildOwnerSummary(payload);
    const sentEmail = await sendBrevoEmail(
      env,
      `Lead scored ${scored.score} (${scored.priority})`,
      joinLines([summary, `Score: ${scored.score}`, `Tags: ${scored.tags.join(", ")}`]),
    );
    const sentSms = await sendBrevoSms(env, `Lead score ${scored.score}: ${readString(payload, "name") || "new lead"}`);
    return sentEmail || sentSms;
  });

  const crmSynced = await step.do("sync lead score to crm", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "lead-scoring-and-tagging",
      lead: payload,
      scoring: scored,
      timestamp: new Date().toISOString(),
    });
  });

  const kpiSynced = await step.do("sync score to kpi", async () => {
    return postToWebhook(env.KPI_WEBHOOK_URL, {
      type: "lead-score",
      score: scored.score,
      priority: scored.priority,
      tags: scored.tags,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "lead-scoring-and-tagging",
    score: scored.score,
    priority: scored.priority,
    ownerNotified,
    crmSynced,
    kpiSynced,
  };
}

async function runMultiChannelFollowUpSequencer(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const stages = parseSequenceStages(payload);
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;

  let delivered = 0;
  let index = 0;

  for (const stage of stages) {
    index += 1;
    await step.sleep(`wait before sequence stage ${index}`, stage.delay);

    const sent = await step.do(`send sequence stage ${index}`, async () => {
      return sendChannelMessage(stage.channel, env, stage.message, {
        emailTo,
        smsTo,
        context: payload,
      });
    });

    if (sent) {
      delivered += 1;
    }
  }

  const crmSynced = await step.do("sync sequencer result to crm", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "multi-channel-follow-up-sequencer",
      delivered,
      attempted: stages.length,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "multi-channel-follow-up-sequencer",
    attempted: stages.length,
    delivered,
    crmSynced,
  };
}

async function runUpsellCrossSellSuggestions(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const delay = readString(payload, "delay") || "7 days";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;
  const offer = readString(payload, "offer") || "Add preventive maintenance for better uptime.";

  await step.sleep("wait before upsell offer", delay);

  const emailSent = await step.do("send upsell email", async () => {
    return sendBrevoEmail(env, "Recommended next step", offer, emailTo);
  });

  const smsSent = await step.do("send upsell sms", async () => {
    return sendBrevoSms(env, offer, smsTo);
  });

  const crmSynced = await step.do("record upsell touchpoint", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "upsell-cross-sell-suggestions",
      offer,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "upsell-cross-sell-suggestions",
    emailSent,
    smsSent,
    crmSynced,
  };
}

async function runReviewAggregationAndPosting(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const delay = readString(payload, "delay") || "2 hours";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;

  await step.sleep("wait before review request", delay);

  const emailSent = await step.do("send review email", async () => {
    return sendBrevoEmail(
      env,
      "How did we do?",
      "Thanks for choosing GenFix. We would love your review.",
      emailTo,
    );
  });

  const smsSent = await step.do("send review sms", async () => {
    return sendBrevoSms(env, "Thanks for choosing GenFix. Please leave us a review.", smsTo);
  });

  const aggregated = await step.do("aggregate and post review", async () => {
    return postToWebhook(env.REVIEW_AGGREGATION_WEBHOOK_URL, {
      type: "review-aggregation-and-posting",
      customer: payload,
      timestamp: new Date().toISOString(),
    });
  });

  const alerted = await step.do("notify internal team", async () => {
    return postToWebhook(env.SLACK_WEBHOOK_URL || env.TEAM_NOTIFICATIONS_WEBHOOK_URL, {
      type: "review-alert",
      message: "Review request triggered and aggregation queued.",
      context: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "review-aggregation-and-posting",
    emailSent,
    smsSent,
    aggregated,
    alerted,
  };
}

async function runPaymentDepositFollowUp(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const depositPaid = readBoolean(payload, "depositPaid");
  if (depositPaid) {
    return {
      template: "payment-deposit-follow-up",
      skipped: true,
      reason: "deposit-already-paid",
    };
  }

  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;

  const reminders: SequenceStage[] = [
    {
      delay: "6 hours",
      channel: "email",
      message: "Friendly reminder: your booking deposit is still pending.",
    },
    {
      delay: "24 hours",
      channel: "sms",
      message: "Quick reminder from GenFix: deposit pending. Reply if you need help.",
    },
  ];

  let sent = 0;
  let index = 0;
  for (const reminder of reminders) {
    index += 1;
    await step.sleep(`wait before deposit reminder ${index}`, reminder.delay);
    const delivered = await step.do(`send deposit reminder ${index}`, async () => {
      return sendChannelMessage(reminder.channel, env, reminder.message, {
        emailTo,
        smsTo,
        context: payload,
      });
    });
    if (delivered) {
      sent += 1;
    }
  }

  const paymentStatusSynced = await step.do("sync payment status", async () => {
    return postToWebhook(env.PAYMENT_STATUS_WEBHOOK_URL || env.CRM_WEBHOOK_URL, {
      type: "payment-deposit-follow-up",
      status: "pending",
      remindersSent: sent,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "payment-deposit-follow-up",
    remindersSent: sent,
    paymentStatusSynced,
  };
}

async function runLostLeadRecovery(step: WorkflowStep, env: Env, payload: JsonObject): Promise<JsonObject> {
  const delay = readString(payload, "delay") || "72 hours";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;
  const message =
    readString(payload, "message") ||
    "We can still help you with a tailored power solution. Reply here and we will pick up from where you left off.";

  await step.sleep("wait before lost lead recovery", delay);

  const channelSent = await step.do("send lost lead recovery message", async () => {
    const emailSent = await sendBrevoEmail(env, "Still interested?", message, emailTo);
    const smsSent = await sendBrevoSms(env, message, smsTo);
    return emailSent || smsSent;
  });

  const retargetingSynced = await step.do("sync retargeting audience", async () => {
    return postToWebhook(env.RETARGETING_WEBHOOK_URL, {
      type: "lost-lead-recovery",
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "lost-lead-recovery",
    channelSent,
    retargetingSynced,
  };
}

async function runEventWebinarReminders(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;
  const eventName = readString(payload, "eventName") || "consultation";

  const confirmationSent = await step.do("send event confirmation", async () => {
    const emailSent = await sendBrevoEmail(
      env,
      `Your ${eventName} is confirmed`,
      `Your ${eventName} is confirmed. We will remind you before it starts.`,
      emailTo,
    );
    const smsSent = await sendBrevoSms(env, `${eventName} confirmed. Reminders will follow.`, smsTo);
    return emailSent || smsSent;
  });

  await step.sleep("wait before event reminder 24h", "24 hours");
  const reminder24h = await step.do("send event reminder 24h", async () => {
    const emailSent = await sendBrevoEmail(
      env,
      `${eventName} reminder`,
      `Reminder: your ${eventName} is in 24 hours.`,
      emailTo,
    );
    const smsSent = await sendBrevoSms(env, `Reminder: ${eventName} is in 24h.`, smsTo);
    return emailSent || smsSent;
  });

  await step.sleep("wait before event reminder 1h", "23 hours");
  const reminder1h = await step.do("send event reminder 1h", async () => {
    const emailSent = await sendBrevoEmail(
      env,
      `${eventName} starts soon`,
      `Reminder: your ${eventName} starts in about one hour.`,
      emailTo,
    );
    const smsSent = await sendBrevoSms(env, `${eventName} starts in about one hour.`, smsTo);
    return emailSent || smsSent;
  });

  await step.sleep("wait before post-event survey", "2 hours");
  const surveySent = await step.do("send post-event survey", async () => {
    return sendBrevoEmail(
      env,
      `How was your ${eventName}?`,
      "Thanks for attending. Please share your feedback in this short survey.",
      emailTo,
    );
  });

  return {
    template: "event-webinar-reminders",
    confirmationSent,
    reminder24h,
    reminder1h,
    surveySent,
  };
}

async function runVipHighValueLeadAlerts(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const budget = readNumber(payload, "budget") || 0;
  const threshold = Number(env.LEAD_SCORING_HIGH_VALUE_THRESHOLD || "3000");
  const serviceType = readString(payload, "serviceType").toLowerCase();
  const vipServices = readStringArray(payload, "vipServices");
  const serviceMatched = vipServices.some((item) => serviceType.includes(item.toLowerCase()));
  const isHighValue = budget >= threshold || serviceMatched;

  if (!isHighValue) {
    return {
      template: "vip-high-value-lead-alerts",
      matched: false,
      budget,
      threshold,
    };
  }

  const ownerMessage = `VIP lead alert: ${readString(payload, "name") || "new lead"} (${budget}).`;

  const ownerAlerted = await step.do("notify owner immediately", async () => {
    const smsSent = await sendBrevoSms(env, ownerMessage);
    const emailSent = await sendBrevoEmail(env, "VIP lead alert", buildOwnerSummary(payload));
    return smsSent || emailSent;
  });

  const teamAlerted = await step.do("notify team channel", async () => {
    return postToWebhook(env.SLACK_WEBHOOK_URL || env.TEAM_NOTIFICATIONS_WEBHOOK_URL, {
      type: "vip-high-value-lead-alerts",
      message: ownerMessage,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  const crmTagged = await step.do("tag vip lead in crm", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "vip-tag",
      tags: ["vip", "priority"],
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "vip-high-value-lead-alerts",
    matched: true,
    ownerAlerted,
    teamAlerted,
    crmTagged,
  };
}

async function runAbandonedFormRecovery(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const delay = readString(payload, "delay") || "2 hours";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;
  const message =
    readString(payload, "message") ||
    "Looks like your booking form was left unfinished. Reply and we can complete it in minutes.";

  await step.sleep("wait before abandoned form recovery", delay);

  const emailSent = await step.do("send abandoned form recovery email", async () => {
    return sendBrevoEmail(env, "Need help finishing your booking?", message, emailTo);
  });

  const smsSent = await step.do("send abandoned form recovery sms", async () => {
    return sendBrevoSms(env, message, smsTo);
  });

  const whatsappSent = await step.do("send abandoned form recovery whatsapp", async () => {
    return sendChannelMessage("whatsapp", env, message, { smsTo, context: payload });
  });

  const crmSynced = await step.do("sync abandoned form event", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "abandoned-form-recovery",
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "abandoned-form-recovery",
    emailSent,
    smsSent,
    whatsappSent,
    crmSynced,
  };
}

async function runLoyaltyRepeatClientAutomation(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const delay = readString(payload, "delay") || "30 days";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;
  const offer = readString(payload, "offer") || "Thank you for being a repeat client. Here is your loyalty offer.";

  await step.sleep("wait before loyalty outreach", delay);

  const emailSent = await step.do("send loyalty email", async () => {
    return sendBrevoEmail(env, "Loyalty offer from GenFix", offer, emailTo);
  });

  const smsSent = await step.do("send loyalty sms", async () => {
    return sendBrevoSms(env, offer, smsTo);
  });

  const crmUpdated = await step.do("update loyalty status in crm", async () => {
    return postToWebhook(env.CRM_WEBHOOK_URL, {
      type: "loyalty-repeat-client-automation",
      status: "repeat-client",
      offer,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "loyalty-repeat-client-automation",
    emailSent,
    smsSent,
    crmUpdated,
  };
}

async function runGeoTargetedPromotions(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const location = readString(payload, "location").toLowerCase() || "unknown";
  const geoOffers = asRecord(payload.geoOffers);
  const localizedOffer =
    readString(geoOffers, location) ||
    readString(payload, "defaultOffer") ||
    "We have localized availability this week. Reply for a tailored recommendation.";
  const emailTo = readString(payload, "emailTo") || undefined;
  const smsTo = readString(payload, "smsTo") || undefined;

  const emailSent = await step.do("send geo-targeted email", async () => {
    return sendBrevoEmail(env, "Offer for your area", localizedOffer, emailTo);
  });

  const smsSent = await step.do("send geo-targeted sms", async () => {
    return sendBrevoSms(env, localizedOffer, smsTo);
  });

  const synced = await step.do("sync geo promotion event", async () => {
    return postToWebhook(env.GEO_PROMOTIONS_WEBHOOK_URL || env.CRM_WEBHOOK_URL, {
      type: "geo-targeted-promotions",
      location,
      offer: localizedOffer,
      lead: payload,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    template: "geo-targeted-promotions",
    location,
    emailSent,
    smsSent,
    synced,
  };
}

async function runInternalKpiDashboardSync(
  step: WorkflowStep,
  env: Env,
  payload: JsonObject,
): Promise<JsonObject> {
  const synced = await step.do("push kpi update", async () => {
    return postToWebhook(env.KPI_WEBHOOK_URL, {
      type: "internal-kpi-dashboard-sync",
      activity: payload,
      syncedAt: new Date().toISOString(),
    });
  });

  return {
    template: "internal-kpi-dashboard-sync",
    synced,
  };
}

export class AutomationWorkflow extends WorkflowEntrypoint<Env, FlowRequest> {
  async run(event: WorkflowEvent<FlowRequest>, step: WorkflowStep): Promise<JsonObject> {
    const requestPayload = asRecord(event.payload || {});
    const rawKind = String(requestPayload.kind || "chat-escalation");
    const kind = resolveFlowKind(rawKind);

    if (!kind) {
      throw new Error(`Unsupported flow kind: ${rawKind}`);
    }

    const payload = asRecord(requestPayload.payload);
    let result: JsonObject;

    switch (kind) {
      case "chat-escalation":
        result = await runChatEscalation(step, this.env, payload);
        break;
      case "lead-scoring-and-tagging":
        result = await runLeadScoringAndTagging(step, this.env, payload);
        break;
      case "multi-channel-follow-up-sequencer":
        result = await runMultiChannelFollowUpSequencer(step, this.env, payload);
        break;
      case "upsell-cross-sell-suggestions":
        result = await runUpsellCrossSellSuggestions(step, this.env, payload);
        break;
      case "review-aggregation-and-posting":
        result = await runReviewAggregationAndPosting(step, this.env, payload);
        break;
      case "payment-deposit-follow-up":
        result = await runPaymentDepositFollowUp(step, this.env, payload);
        break;
      case "lost-lead-recovery":
        result = await runLostLeadRecovery(step, this.env, payload);
        break;
      case "event-webinar-reminders":
        result = await runEventWebinarReminders(step, this.env, payload);
        break;
      case "vip-high-value-lead-alerts":
        result = await runVipHighValueLeadAlerts(step, this.env, payload);
        break;
      case "abandoned-form-recovery":
        result = await runAbandonedFormRecovery(step, this.env, payload);
        break;
      case "loyalty-repeat-client-automation":
        result = await runLoyaltyRepeatClientAutomation(step, this.env, payload);
        break;
      case "geo-targeted-promotions":
        result = await runGeoTargetedPromotions(step, this.env, payload);
        break;
      case "internal-kpi-dashboard-sync":
        result = await runInternalKpiDashboardSync(step, this.env, payload);
        break;
      default:
        throw new Error(`Unsupported flow kind: ${kind}`);
    }

    return {
      ok: true,
      kind,
      instanceId: event.instanceId,
      ...result,
    };
  }
}

async function triggerFlow(env: Env, flow: FlowRequest): Promise<{ id: string }> {
  const instance = await env.AUTOMATION_WORKFLOW.create({
    params: flow,
  });
  return { id: instance.id };
}

async function dispatchScheduledFlows(env: Env): Promise<void> {
  const kinds = parseScheduledFlowKinds(env.AUTOMATION_SCHEDULED_FLOWS);
  for (const kind of kinds) {
    await triggerFlow(env, { kind, payload: {} });
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!ensureToken(request, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/automation/dispatch") {
      const body = asRecord(await request.json());
      const rawKind = readString(body, "kind");

      let kind: CanonicalFlowKind | null = null;
      let payload: JsonObject;

      if (rawKind) {
        kind = resolveFlowKind(rawKind);
        if (!kind) {
          return Response.json(
            {
              ok: false,
              error: `Unsupported flow kind: ${rawKind}`,
              supportedFlowKinds: CANONICAL_FLOWS,
            },
            { status: 400 },
          );
        }
        payload = asRecord(body.payload);
      } else {
        kind = "chat-escalation";
        payload = body;
      }

      const instance = await triggerFlow(env, { kind, payload });
      return Response.json({ ok: true, kind, instanceId: instance.id }, { status: 202 });
    }

    if (request.method === "GET" && url.pathname.startsWith("/automation/instances/")) {
      const id = url.pathname.slice("/automation/instances/".length).trim();
      if (!id) {
        return new Response("Missing instance id", { status: 400 });
      }

      const instance = await env.AUTOMATION_WORKFLOW.get(id);
      const status = await instance.status();
      return Response.json({ ok: true, id, status });
    }

    if (request.method === "GET" && url.pathname === "/automation/kinds") {
      return Response.json({ ok: true, flowKinds: CANONICAL_FLOWS });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(dispatchScheduledFlows(env));
  },
};

export default worker;
