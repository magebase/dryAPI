import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  defaultEmailBranding,
  resolveCurrentEmailBranding,
} from "@/emails/brand";
import { ChatEscalationEmail } from "@/emails/chat-escalation-email";
import {
  buildFallbackSalesAnswer,
  detectEscalationIntent,
  detectLowConfidenceAnswer,
  detectQuoteIntent,
  normalizeConversation,
  type ChatMessage,
} from "@/lib/chat-assistant";
import {
  formatAiSearchPromptContext,
  searchCloudflareAiContext,
} from "@/lib/cloudflare-ai-search";
import { sendBrevoReactEmail } from "@/lib/brevo-email";
import { moderateInput } from "@/lib/content-moderation";
import {
  inferEnquiryQueue,
  resolveFromEmailForChannel,
  resolveFromNameForChannel,
  resolveRecipientForQueue,
  type EnquiryQueue,
} from "@/lib/enquiry-routing";
import {
  isAiChatbotEnabledServer,
  isBrevoEmailNotificationsEnabled,
  isBrevoSmsNotificationsEnabled,
  isWorkflowAutomationsEnabled,
} from "@/lib/feature-flags";
import {
  buildEscalationFollowupNote,
  extractVisitorContact,
} from "@/lib/chat-followup";
import { persistModerationRejectionAttempt } from "@/lib/moderation-rejection-store";
import { readSiteConfig } from "@/lib/site-content-loader";
import { recordStripeMeterUsage } from "@/lib/stripe-metering";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

const contactCaptureSchema = z
  .object({
    email: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide an email or phone for chat contact capture.",
      });
    }

    if (value.email && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contact capture email must be valid.",
        path: ["email"],
      });
    }

    if (value.phone) {
      const digitsOnly = value.phone.replace(/\D/g, "");
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contact capture phone must include 8-15 digits.",
          path: ["phone"],
        });
      }
    }
  });

const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).optional().default([]),
    pagePath: z.string().trim().default("/"),
    visitorId: z.string().trim().default("anonymous"),
    allowEscalation: z.boolean().optional().default(true),
    turnstileToken: z.string().trim().optional().default(""),
    contactCapture: contactCaptureSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.contactCapture && value.messages.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No user message provided.",
        path: ["messages"],
      });
    }
  });

const CHAT_FREQUENCY_WINDOW_MS = 5 * 60 * 1000;
const CHAT_FREQUENCY_THRESHOLD = 6;
const CHAT_FREQUENCY_MAX_KEYS = 1_000;
const frequentVisitorMessages = new Map<string, number[]>();

function trimAndTrackVisitorFrequency(key: string): boolean {
  const now = Date.now();
  const recent = (frequentVisitorMessages.get(key) || []).filter(
    (timestamp) => now - timestamp <= CHAT_FREQUENCY_WINDOW_MS,
  );
  recent.push(now);
  frequentVisitorMessages.set(key, recent);

  if (frequentVisitorMessages.size > CHAT_FREQUENCY_MAX_KEYS) {
    const oldestKey = frequentVisitorMessages.keys().next().value;
    if (oldestKey) {
      frequentVisitorMessages.delete(oldestKey);
    }
  }

  return recent.length > CHAT_FREQUENCY_THRESHOLD;
}

function getChatFrequencyKey({
  visitorId,
  request,
}: {
  visitorId: string;
  request: NextRequest;
}): string {
  const cleanVisitorId = visitorId.trim().toLowerCase();
  if (cleanVisitorId && cleanVisitorId !== "anonymous") {
    return `visitor:${cleanVisitorId}`;
  }

  const ip = getRequestIp(request);
  if (ip) {
    return `ip:${ip}`;
  }

  return "fallback:anonymous";
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type ModelAnswer = {
  answer?: unknown;
  confidence?: unknown;
  readyForQuote?: unknown;
  needsHumanFollowup?: unknown;
};

type GeneratedAssistantAnswer = {
  answer: string;
  showQuoteButton: boolean;
  shouldEscalate: boolean;
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizePath(path: string): string {
  if (!path || !path.startsWith("/")) {
    return "/";
  }

  return path;
}

function normalizeConfidence(input: unknown): "high" | "low" {
  return String(input).toLowerCase() === "high" ? "high" : "low";
}

function normalizeBoolean(input: unknown): boolean {
  if (typeof input === "boolean") {
    return input;
  }

  return String(input).toLowerCase() === "true";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "Visitor"}: ${message.content}`,
    )
    .join("\n");
}

function buildPrompt({
  messages,
  pagePath,
  quoteCtaLabel,
  brandMark,
  aiSearchContext,
}: {
  messages: ChatMessage[];
  pagePath: string;
  quoteCtaLabel: string;
  brandMark: string;
  aiSearchContext: string;
}): string {
  const conversation = formatConversation(messages);

  return [
    "You are the dryAPI website assistant for dryapi.com.",
    "Product focus: unified AI inference for chat, images, speech, and embeddings with OpenAI/OpenRouter-compatible APIs, usage controls, and credit-based billing.",
    "Primary behavior requirements:",
    "- Answer clearly and practically.",
    "- Keep replies technical and conversion-oriented without being pushy.",
    "- If the visitor asks about pricing, plans, enterprise, or contracts, recommend requesting a quote.",
    "- If the visitor asks implementation questions, provide concrete API-oriented next steps.",
    "- If uncertain, be transparent and set needsHumanFollowup=true.",
    "- Never invent unavailable company details, pricing terms, model availability, or SLA claims.",
    "Quote CTA label:",
    quoteCtaLabel,
    "Brand mark:",
    brandMark,
    "Current page path:",
    pagePath,
    "Cloudflare AI Search grounding context:",
    aiSearchContext,
    "Conversation transcript:",
    conversation,
    "Return strict JSON only with this exact shape:",
    '{"answer":"string","confidence":"high|low","readyForQuote":true,"needsHumanFollowup":false}',
  ].join("\n");
}

async function callGemini({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<GeneratedAssistantAnswer> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiResponse;

  await recordStripeMeterUsage({
    eventType: "ai_model_call",
    metadata: {
      provider: "gemini",
      surface: "chat",
      model,
      status: response.status,
    },
  });

  if (!response.ok) {
    const message =
      payload.error?.message ||
      `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  const rawText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
  const modelText = stripCodeFence(rawText);

  if (!modelText) {
    throw new Error("Gemini returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  const normalized = parsed as ModelAnswer;
  const answer = asText(normalized.answer);

  if (!answer) {
    throw new Error("Gemini response missing answer");
  }

  const confidence = normalizeConfidence(normalized.confidence);
  const readyForQuote = normalizeBoolean(normalized.readyForQuote);
  const needsHumanFollowup = normalizeBoolean(normalized.needsHumanFollowup);

  return {
    answer,
    showQuoteButton: readyForQuote,
    shouldEscalate:
      confidence === "low" ||
      needsHumanFollowup ||
      detectLowConfidenceAnswer(answer),
  };
}

async function sendEscalationWebhook({
  url,
  token,
  payload,
}: {
  url: string;
  token: string | null;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const headers: HeadersInit = {
    "content-type": "application/json",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers["x-workflow-internal-token"] = token;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  await recordStripeMeterUsage({
    eventType: "workflow_dispatch",
    metadata: {
      surface: "chat",
      flow: "chat-escalation",
      status: response.status,
    },
  });

  return response.ok;
}

async function sendEscalationEmail({
  recipient,
  queue,
  question,
  conversation,
  pagePath,
  visitorId,
  visitorEmail,
  visitorPhone,
}: {
  recipient: string;
  queue: EnquiryQueue;
  question: string;
  conversation: ChatMessage[];
  pagePath: string;
  visitorId: string;
  visitorEmail: string | null;
  visitorPhone: string | null;
}): Promise<boolean> {
  if (!isBrevoEmailNotificationsEnabled()) {
    return false;
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = resolveFromEmailForChannel({
    channel: "chat",
    env: process.env,
  });
  const fromName = resolveFromNameForChannel({
    channel: "chat",
    env: process.env,
  });

  if (!apiKey || !fromEmail) {
    return false;
  }

  const emailBranding = await resolveCurrentEmailBranding().catch(
    () => defaultEmailBranding,
  );

  await sendBrevoReactEmail({
    apiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: recipient }],
    subject: `${emailBranding.mark} chat escalation (${queue}): ${question.slice(0, 72)}`,
    react: ChatEscalationEmail({
      branding: emailBranding,
      question,
      queue,
      pagePath,
      visitorId,
      visitorEmail,
      visitorPhone,
      submittedAt: new Date().toISOString(),
      conversation: formatConversation(conversation),
    }),
    tags: ["chatbot", "escalation", "website"],
  });

  return true;
}

async function sendEscalationSms({
  question,
}: {
  question: string;
}): Promise<boolean> {
  if (!isBrevoSmsNotificationsEnabled()) {
    return false;
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  const recipient = process.env.BREVO_ESCALATION_SMS_TO?.trim();

  if (!apiKey || !sender || !recipient) {
    return false;
  }

  const response = await fetch(
    "https://api.brevo.com/v3/transactionalSMS/sms",
    {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        recipient,
        content: `dryAPI chat escalation: ${question}`.slice(0, 150),
        type: "transactional",
      }),
    },
  );

  await recordStripeMeterUsage({
    eventType: "brevo_sms_send",
    metadata: {
      provider: "brevo",
      surface: "chat",
      status: response.status,
    },
  });

  return response.ok;
}

async function notifyEscalation({
  queue,
  question,
  conversation,
  pagePath,
  visitorId,
  recipient,
  visitorEmail,
  visitorPhone,
}: {
  queue: EnquiryQueue;
  question: string;
  conversation: ChatMessage[];
  pagePath: string;
  visitorId: string;
  recipient: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
}): Promise<boolean> {
  const webhookUrl =
    process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_URL?.trim() || "";
  const webhookToken =
    process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_TOKEN?.trim() || null;
  const workflowAutomationsEnabled = isWorkflowAutomationsEnabled();

  const tasks: Array<Promise<boolean>> = [];

  if (workflowAutomationsEnabled && webhookUrl) {
    tasks.push(
      sendEscalationWebhook({
        url: webhookUrl,
        token: webhookToken,
        payload: {
          source: "dryapi-chatbot",
          queue,
          pagePath,
          visitorId,
          visitorEmail,
          visitorPhone,
          emailTo: recipient,
          question,
          conversation,
          requestedAt: new Date().toISOString(),
          reference:
            "https://developers.cloudflare.com/ai-search/llms-full.txt",
        },
      }).catch(() => false),
    );
  }

  if (recipient) {
    tasks.push(
      sendEscalationEmail({
        recipient,
        queue,
        question,
        conversation,
        pagePath,
        visitorId,
        visitorEmail,
        visitorPhone,
      }).catch(() => false),
    );
  }

  tasks.push(sendEscalationSms({ question }).catch(() => false));

  const results = await Promise.all(tasks);
  return results.some(Boolean);
}

export async function POST(request: NextRequest) {
  if (!isAiChatbotEnabledServer()) {
    return NextResponse.json(
      {
        ok: false,
        error: "AI chatbot is currently disabled.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);
    const messages = normalizeConversation(parsed.messages);
    const normalizedPagePath = normalizePath(parsed.pagePath);
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const capturedContact = parsed.contactCapture
      ? {
          email: parsed.contactCapture.email || null,
          phone: parsed.contactCapture.phone || null,
          hasContact: Boolean(
            parsed.contactCapture.email || parsed.contactCapture.phone,
          ),
        }
      : null;

    if (!latestUserMessage && !capturedContact) {
      return NextResponse.json(
        { ok: false, error: "No user message provided." },
        { status: 400 },
      );
    }

    if (!capturedContact) {
      const frequencyKey = getChatFrequencyKey({
        visitorId: parsed.visitorId,
        request,
      });
      const requiresTurnstile = trimAndTrackVisitorFrequency(frequencyKey);

      if (requiresTurnstile) {
        const turnstile = await verifyTurnstileToken({
          token: parsed.turnstileToken,
          action: "chat_frequent",
          remoteIp: getRequestIp(request),
        });

        if (!turnstile.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: "Please complete verification to continue chatting.",
              requiresTurnstile: true,
              codes: turnstile.codes,
            },
            { status: 429 },
          );
        }
      }
    }

    let quoteCtaLabel = "Get A Quote";
    let escalationRecipientFallback: string | null =
      process.env.CHAT_ESCALATION_EMAIL_DEFAULT_TO?.trim() ||
      process.env.CHAT_ESCALATION_EMAIL_TO?.trim() ||
      null;
    let brandMark = "dryAPI";

    try {
      const siteConfig = await readSiteConfig();
      quoteCtaLabel = siteConfig.header.quoteCta.label;
      brandMark = siteConfig.brand.mark;
      if (!escalationRecipientFallback) {
        escalationRecipientFallback = siteConfig.contact.contactEmail;
      }
    } catch {
      // Continue with safe defaults if site config is unavailable.
    }

    if (capturedContact) {
      const referenceQuestion =
        latestUserMessage?.content ||
        "Visitor shared follow-up contact details from the chat widget.";

      const contactCaptureModeration = await moderateInput({
        channel: "chat",
        textParts: [
          referenceQuestion,
          capturedContact.email || "",
          capturedContact.phone || "",
        ],
      });

      if (!contactCaptureModeration.allowed) {
        try {
          await persistModerationRejectionAttempt({
            channel: "chat",
            sourcePath: normalizedPagePath,
            reason: contactCaptureModeration.reason,
            model: contactCaptureModeration.model,
            categories: contactCaptureModeration.categories,
          });
        } catch (error) {
          console.error("Unable to store chat moderation rejection", error);
        }

        return NextResponse.json(
          {
            ok: false,
            error: "Your message was blocked by safety checks.",
          },
          { status: 400 },
        );
      }

      const queue = inferEnquiryQueue({
        question: referenceQuestion,
        message: formatConversation(messages),
      });
      const escalationRecipient = resolveRecipientForQueue({
        channel: "chat",
        queue,
        env: process.env,
        fallbackRecipient: escalationRecipientFallback,
      });

      const escalated = parsed.allowEscalation
        ? await notifyEscalation({
            queue,
            question: referenceQuestion,
            conversation: messages,
            pagePath: normalizedPagePath,
            visitorId: parsed.visitorId,
            recipient: escalationRecipient,
            visitorEmail: capturedContact.email,
            visitorPhone: capturedContact.phone,
          })
        : false;

      return NextResponse.json({
        ok: true,
        answer: escalated
          ? `Thanks, I have shared your contact details with our ${queue === "general" ? "team" : `${queue} team`} for follow-up.`
          : "Thanks, I captured your contact details. We could not dispatch the alert automatically, so please also use the quote form if your request is urgent.",
        showQuoteButton: !escalated,
        escalated,
        needsContactCapture: false,
      });
    }

    const question = latestUserMessage?.content || "";
    const userInputsForModeration = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .slice(-4);
    const chatModeration = await moderateInput({
      channel: "chat",
      textParts: userInputsForModeration,
    });

    if (!chatModeration.allowed) {
      try {
        await persistModerationRejectionAttempt({
          channel: "chat",
          sourcePath: normalizedPagePath,
          reason: chatModeration.reason,
          model: chatModeration.model,
          categories: chatModeration.categories,
        });
      } catch (error) {
        console.error("Unable to store chat moderation rejection", error);
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Your message was blocked by safety checks.",
        },
        { status: 400 },
      );
    }

    const visitorContact = extractVisitorContact(messages);
    const queue = inferEnquiryQueue({
      question,
      message: formatConversation(messages),
    });
    const escalationRecipient = resolveRecipientForQueue({
      channel: "chat",
      queue,
      env: process.env,
      fallbackRecipient: escalationRecipientFallback,
    });
    const quoteIntent = detectQuoteIntent(question);
    const explicitEscalation = detectEscalationIntent(question);

    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      "";
    const model = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.5-flash";
    const aiSearchContext = formatAiSearchPromptContext(
      await searchCloudflareAiContext({
        query: question,
      }),
    );

    let assistant: GeneratedAssistantAnswer;

    if (apiKey) {
      const prompt = buildPrompt({
        messages,
        pagePath: normalizedPagePath,
        quoteCtaLabel,
        brandMark,
        aiSearchContext,
      });

      try {
        assistant = await callGemini({
          apiKey,
          model,
          prompt,
        });
      } catch {
        assistant = buildFallbackSalesAnswer(question);
      }
    } else {
      assistant = buildFallbackSalesAnswer(question);
    }

    const showQuoteButton = quoteIntent || assistant.showQuoteButton;
    const shouldEscalate =
      parsed.allowEscalation &&
      (explicitEscalation || assistant.shouldEscalate);

    let escalated = false;
    if (shouldEscalate) {
      escalated = await notifyEscalation({
        queue,
        question,
        conversation: messages,
        pagePath: normalizedPagePath,
        visitorId: parsed.visitorId,
        recipient: escalationRecipient,
        visitorEmail: visitorContact.email,
        visitorPhone: visitorContact.phone,
      });
    }

    const needsContactCapture = shouldEscalate && !visitorContact.hasContact;

    const answer = shouldEscalate
      ? `${assistant.answer}\n\n${buildEscalationFollowupNote({
          escalated,
          hasVisitorContact: visitorContact.hasContact,
        })}`
      : assistant.answer;

    return NextResponse.json({
      ok: true,
      answer,
      showQuoteButton,
      escalated,
      needsContactCapture,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to process chat request.",
      },
      { status: 500 },
    );
  }
}
