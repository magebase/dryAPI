import { describeRoute } from "hono-openapi";
import type { Hono } from "hono";

import type { AccountExportQueueMessage, WorkerEnv } from "../../types";

function readCreditUserEmail(c: { get(name: string): unknown }): string | null {
  const userEmail = c.get("creditUserId");
  if (typeof userEmail === "string" && userEmail.trim().length > 0) {
    return userEmail.trim().toLowerCase();
  }

  return null;
}

export function registerAccountExportsRoute(app: Hono<WorkerEnv>) {
  app.post(
    "/v1/account-exports",
    describeRoute({
      tags: ["Account Exports"],
      operationId: "requestAccountExport",
      summary: "Queue an account export",
      description:
        "Enqueues a private account export job that generates a ZIP, stores it in R2, and emails the secure download page.",
      security: [{ BearerAuth: [] }],
      responses: {
        202: {
          description: "Export request accepted and queued.",
        },
        401: {
          description: "Missing or invalid auth context.",
        },
        500: {
          description: "Queue configuration or dispatch error.",
        },
      },
    }),
    async (c) => {
      const userEmail = readCreditUserEmail(c)

      if (!userEmail) {
        return c.json(
          {
            error: {
              code: "unauthorized",
              message: "Sign in to request an account export.",
            },
          },
          401,
        )
      }

      if (!c.env.ACCOUNT_EXPORT_QUEUE) {
        return c.json(
          {
            error: {
              code: "missing_queue_binding",
              message: "ACCOUNT_EXPORT_QUEUE is not configured.",
            },
          },
          500,
        )
      }

      const requestId = crypto.randomUUID()
      const message: AccountExportQueueMessage = {
        requestId,
        userEmail,
        requestedAt: new Date().toISOString(),
      }

      await c.env.ACCOUNT_EXPORT_QUEUE.send(message)

      return c.json(
        {
          ok: true,
          status: "queued",
          request_id: requestId,
          user_email: userEmail,
        },
        202,
      )
    },
  )
}