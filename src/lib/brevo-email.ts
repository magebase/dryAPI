import { render } from "@react-email/render";
import type { ReactElement } from "react";

type BrevoRecipient = {
  email: string;
  name?: string;
};

type BrevoReplyTo = {
  email: string;
  name?: string;
};

type BrevoAttachment = {
  name: string;
  content: string;
  contentType?: string;
};

type SendBrevoReactEmailOptions = {
  apiKey: string;
  from: BrevoRecipient;
  to: BrevoRecipient[];
  subject: string;
  react: ReactElement;
  replyTo?: BrevoReplyTo;
  tags?: string[];
  attachments?: BrevoAttachment[];
};

type BrevoSendResult = {
  messageId: string | null;
};

type BrevoSendResponse = {
  messageId?: string;
  code?: string;
  message?: string;
};

export async function sendBrevoReactEmail(
  options: SendBrevoReactEmailOptions,
): Promise<BrevoSendResult> {
  const [htmlContent, textContent] = await Promise.all([
    render(options.react),
    render(options.react, { plainText: true }),
  ]);
  const normalizedTextContent = textContent.replace(/\n{3,}/g, "\n\n").trim();

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": options.apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: options.from,
      to: options.to,
      subject: options.subject,
      htmlContent,
      textContent: normalizedTextContent || undefined,
      replyTo: options.replyTo,
      tags: options.tags,
      attachment: options.attachments,
    }),
  });

  let payload: BrevoSendResponse | null = null;
  try {
    payload = (await response.json()) as BrevoSendResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload
      ? [payload.code, payload.message, payload.messageId]
          .filter(Boolean)
          .join(" | ")
      : "no response body";
    throw new Error(
      `Brevo transactional email failed (${response.status}): ${details}`,
    );
  }

  return {
    messageId:
      typeof payload?.messageId === "string" ? payload.messageId : null,
  };
}
