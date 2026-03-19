import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import {
  getDashboardSettingsForUser,
  updateDashboardSettingsSection,
  type DashboardSettingsSection,
} from "@/lib/dashboard-settings-store";
import { dashboardSettingsSectionSchema } from "@/lib/dashboard-settings-schema";

const updatePayloadSchema = z.object({
  section: dashboardSettingsSectionSchema,
  values: z.unknown(),
});

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "unauthorized",
      message: "Sign in to manage dashboard settings.",
    },
    { status: 401 },
  );
}

function serializeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Invalid settings payload.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to process dashboard settings request.";
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return unauthorizedResponse();
  }

  try {
    const settings = await getDashboardSettingsForUser(session.email);
    return NextResponse.json({ data: settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: "settings_load_failed",
        message: serializeErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return unauthorizedResponse();
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = updatePayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message:
          parsedPayload.error.issues[0]?.message || "Invalid settings payload.",
      },
      { status: 400 },
    );
  }

  try {
    const settings = await updateDashboardSettingsSection({
      userEmail: session.email,
      section: parsedPayload.data.section as DashboardSettingsSection,
      values: parsedPayload.data.values,
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      {
        error: status === 400 ? "invalid_payload" : "settings_save_failed",
        message: serializeErrorMessage(error),
      },
      { status },
    );
  }
}
