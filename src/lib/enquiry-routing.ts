type EnquiryQueue = "sales" | "rentals" | "servicing" | "parts" | "general";

type EmailChannel = "contact" | "quote" | "chat";
type EmailRoutingEnv = Record<string, string | undefined>;

const SALES_PATTERN =
  /\b(sale|sales|buy|purchase|owned|ownership|new\s+generator)\b/i;
const RENTALS_PATTERN = /\b(rental|rent|hire|hiring|temporary|short\s*term)\b/i;
const SERVICING_PATTERN =
  /\b(service|servicing|maintenance|repair|load\s*test|inspection|compliance)\b/i;
const PARTS_PATTERN =
  /\b(parts?|spares?|filter|battery|alternator|controller|starter)\b/i;

function clean(value: string | null | undefined): string {
  return (value || "").trim();
}

function parseEnvEmail(env: EmailRoutingEnv, key: string): string | null {
  const value = env[key];
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function queueToSuffix(queue: Exclude<EnquiryQueue, "general">): string {
  if (queue === "sales") {
    return "SALES";
  }

  if (queue === "rentals") {
    return "RENTALS";
  }

  if (queue === "servicing") {
    return "SERVICING";
  }

  return "PARTS";
}

function channelPrefix(channel: EmailChannel): string {
  if (channel === "contact") {
    return "CONTACT";
  }

  if (channel === "quote") {
    return "QUOTE";
  }

  return "CHAT_ESCALATION";
}

export function inferEnquiryQueue({
  enquiryType,
  message,
  question,
}: {
  enquiryType?: string | null;
  message?: string | null;
  question?: string | null;
}): EnquiryQueue {
  const enquiry = clean(enquiryType).toLowerCase();
  const haystack =
    `${clean(enquiryType)} ${clean(message)} ${clean(question)}`.toLowerCase();

  if (enquiry.includes("part") || PARTS_PATTERN.test(haystack)) {
    return "parts";
  }

  if (
    enquiry.includes("rent") ||
    enquiry.includes("hire") ||
    RENTALS_PATTERN.test(haystack)
  ) {
    return "rentals";
  }

  if (enquiry.includes("service") || SERVICING_PATTERN.test(haystack)) {
    return "servicing";
  }

  if (enquiry.includes("sale") || SALES_PATTERN.test(haystack)) {
    return "sales";
  }

  return "general";
}

export function resolveRecipientForQueue({
  channel,
  queue,
  env,
  fallbackRecipient,
}: {
  channel: EmailChannel;
  queue: EnquiryQueue;
  env: EmailRoutingEnv;
  fallbackRecipient?: string | null;
}): string | null {
  const prefix = channelPrefix(channel);
  const fallback = clean(fallbackRecipient).toLowerCase() || null;

  if (queue !== "general") {
    const suffix = queueToSuffix(queue);
    const channelSpecific = parseEnvEmail(env, `${prefix}_EMAIL_${suffix}_TO`);
    if (channelSpecific) {
      return channelSpecific;
    }

    const globalSpecific = parseEnvEmail(env, `DRYAPI_EMAIL_${suffix}_TO`);
    if (globalSpecific) {
      return globalSpecific;
    }
  }

  const channelDefault = parseEnvEmail(env, `${prefix}_EMAIL_DEFAULT_TO`);
  if (channelDefault) {
    return channelDefault;
  }

  const legacyChatDefault =
    channel === "chat" ? parseEnvEmail(env, "CHAT_ESCALATION_EMAIL_TO") : null;
  if (legacyChatDefault) {
    return legacyChatDefault;
  }

  const globalDefault = parseEnvEmail(env, "DRYAPI_EMAIL_DEFAULT_TO");
  if (globalDefault) {
    return globalDefault;
  }

  return fallback;
}

export function resolveFromEmailForChannel({
  channel,
  env,
}: {
  channel: EmailChannel;
  env: EmailRoutingEnv;
}): string | null {
  if (channel === "contact") {
    return parseEnvEmail(env, "BREVO_FROM_EMAIL_CONTACT");
  }

  if (channel === "quote") {
    return parseEnvEmail(env, "BREVO_FROM_EMAIL_QUOTE");
  }

  return parseEnvEmail(env, "BREVO_FROM_EMAIL_CHAT");
}

export function resolveFromNameForChannel({
  channel,
  env,
}: {
  channel: EmailChannel;
  env: EmailRoutingEnv;
}): string {
  if (channel === "contact") {
    return (
      clean(env.BREVO_FROM_NAME_CONTACT) ||
      clean(env.BREVO_FROM_NAME) ||
      "GenFix"
    );
  }

  if (channel === "quote") {
    return (
      clean(env.BREVO_FROM_NAME_QUOTE) || clean(env.BREVO_FROM_NAME) || "GenFix"
    );
  }

  return (
    clean(env.BREVO_FROM_NAME_CHAT) || clean(env.BREVO_FROM_NAME) || "GenFix"
  );
}

export type { EmailChannel, EnquiryQueue };
