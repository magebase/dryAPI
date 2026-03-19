import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { verifyCloudflareAccess } from "@/lib/cloudflare-access";
import {
  createCmsResourceRecord,
  isCmsResourceName,
  listCmsResource,
} from "@/lib/cms-store";

function parseJsonParam<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    return payload.data as Record<string, unknown>;
  }

  return (payload as Record<string, unknown>) ?? {};
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { resource } = await context.params;

  if (!isCmsResourceName(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }

  const range = parseJsonParam<[number, number]>(
    request.nextUrl.searchParams.get("range"),
    [0, 24],
  );
  const filter = parseJsonParam<Record<string, unknown>>(
    request.nextUrl.searchParams.get("filter"),
    {},
  );

  const result = await listCmsResource(resource, {
    start: range[0] ?? 0,
    end: range[1] ?? 24,
    filter,
  });

  return NextResponse.json(result.data, {
    headers: {
      "Content-Range": `${resource} ${result.start}-${result.end}/${result.total}`,
      "Access-Control-Expose-Headers": "Content-Range",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const auth = await verifyCloudflareAccess(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { resource } = await context.params;

  if (!isCmsResourceName(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }

  try {
    const rawPayload = await request.json();
    const record = await createCmsResourceRecord(
      resource,
      getPayload(rawPayload),
    );
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create record" },
      { status: 500 },
    );
  }
}
