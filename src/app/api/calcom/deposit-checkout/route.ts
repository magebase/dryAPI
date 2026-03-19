import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  buildStripeDepositCheckoutParams,
  DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS,
  isPresetCreditTopUpAmountCents,
  normalizeCurrencyCode,
  parseAutoTopUpThresholdToCents,
  parseDepositAmountToCents,
  parseDepositCents,
  resolveTopUpCharge,
  sanitizeDepositMetadata,
} from "@/lib/stripe-deposit-checkout";
import { resolveActiveBrand } from "@/lib/brand-catalog";
import { isStripeDepositsEnabledServer } from "@/lib/feature-flags";
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile";

const checkoutRequestSchema = z
  .object({
    amount: z.union([z.number(), z.string()]).optional(),
    amountCents: z.union([z.number(), z.string()]).optional(),
    currency: z.string().optional(),
    calcomBookingUrl: z.string().url().optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    customerEmail: z.string().email().optional(),
    description: z.string().trim().max(120).optional(),
    autoTopUpEnabled: z.boolean().optional(),
    autoTopUpThreshold: z.union([z.number(), z.string()]).optional(),
    turnstileToken: z.string().optional(),
    metadata: z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.amount === undefined && value.amountCents === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Provide either amount or amountCents",
      });
    }

    if (value.amount !== undefined && value.amountCents !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Provide amount or amountCents, not both",
      });
    }
  });

type StripeCheckoutSessionResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

function isHttpsOrHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function shouldRequireTurnstile(): boolean {
  return (
    (process.env.STRIPE_DEPOSIT_TURNSTILE_REQUIRED || "false")
      .trim()
      .toLowerCase() === "true"
  );
}

function resolveRedirectUrls(input: z.infer<typeof checkoutRequestSchema>): {
  successUrl: string;
  cancelUrl: string;
} {
  const fallbackBookingUrl = input.calcomBookingUrl?.trim();
  const defaultSuccess =
    process.env.STRIPE_DEPOSIT_DEFAULT_SUCCESS_URL?.trim() || "";
  const defaultCancel =
    process.env.STRIPE_DEPOSIT_DEFAULT_CANCEL_URL?.trim() || "";

  const successUrl =
    input.successUrl?.trim() || fallbackBookingUrl || defaultSuccess;
  const cancelUrl =
    input.cancelUrl?.trim() ||
    fallbackBookingUrl ||
    defaultCancel ||
    successUrl;

  if (!successUrl || !cancelUrl) {
    throw new Error(
      "Missing checkout redirect URLs. Provide successUrl/cancelUrl, calcomBookingUrl, or STRIPE_DEPOSIT_DEFAULT_* env vars",
    );
  }

  if (!isHttpsOrHttpUrl(successUrl) || !isHttpsOrHttpUrl(cancelUrl)) {
    throw new Error("Redirect URLs must be valid http or https URLs");
  }

  return {
    successUrl,
    cancelUrl,
  };
}

function parseAmount(input: z.infer<typeof checkoutRequestSchema>): number {
  if (input.amountCents !== undefined) {
    return parseDepositCents(input.amountCents);
  }

  if (input.amount !== undefined) {
    return parseDepositAmountToCents(input.amount);
  }

  throw new Error("Missing amount");
}

export async function POST(request: NextRequest) {
  if (!isStripeDepositsEnabledServer()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe deposit checkout is currently disabled.",
      },
      { status: 404 },
    );
  }

  try {
    const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim();
    if (!stripePrivateKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing STRIPE_PRIVATE_KEY",
        },
        { status: 500 },
      );
    }

    const payload = checkoutRequestSchema.parse(await request.json());

    if (shouldRequireTurnstile()) {
      const turnstile = await verifyTurnstileToken({
        token: payload.turnstileToken || "",
        action: "calcom_deposit_checkout",
        remoteIp: getRequestIp(request),
      });

      if (!turnstile.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: turnstile.error,
            codes: turnstile.codes,
          },
          { status: 400 },
        );
      }
    }

    const amountCents = parseAmount(payload);
    const topUp = resolveTopUpCharge(amountCents);
    const autoTopUpEnabled = payload.autoTopUpEnabled ?? true;
    const autoTopUpThresholdCents = autoTopUpEnabled
      ? parseAutoTopUpThresholdToCents(payload.autoTopUpThreshold)
      : DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS;
    const currency = normalizeCurrencyCode(
      payload.currency || process.env.STRIPE_DEPOSIT_DEFAULT_CURRENCY || "aud",
    );
    const { successUrl, cancelUrl } = resolveRedirectUrls(payload);
    const brand = await resolveActiveBrand({
      hostname: new URL(successUrl).hostname || new URL(cancelUrl).hostname,
    });
    const metadata = sanitizeDepositMetadata({
      ...(payload.metadata || {}),
      requestedAmountCents: topUp.requestedAmountCents,
      chargeAmountCents: topUp.chargeAmountCents,
      discountCents: topUp.discountCents,
      creditsGranted: topUp.creditsGranted,
      autoTopUpEnabled,
      autoTopUpThresholdCents,
      isPresetAmount: isPresetCreditTopUpAmountCents(
        topUp.requestedAmountCents,
      ),
      calcomBookingUrl: payload.calcomBookingUrl || "",
    });
    metadata.dryapi_brand_key = brand.key;
    metadata.source = "genfix-calcom-deposit";

    const sessionParams = buildStripeDepositCheckoutParams({
      amountCents: topUp.chargeAmountCents,
      currency,
      successUrl,
      cancelUrl,
      description:
        payload.description ||
        `${topUp.creditsGranted.toFixed(2)} credits top-up${topUp.discountCents > 0 ? " (5% off applied)" : ""}`,
      customerEmail: payload.customerEmail,
      metadata,
    });

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${stripePrivateKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      },
    );

    const body = (await stripeResponse
      .json()
      .catch(() => null)) as StripeCheckoutSessionResponse | null;

    if (!stripeResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            body?.error?.message ||
            `Stripe checkout session creation failed (${stripeResponse.status})`,
        },
        { status: 502 },
      );
    }

    if (!body?.url || !body.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe checkout session response was missing id or url",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl: body.url,
      sessionId: body.id,
      amountCents: topUp.chargeAmountCents,
      requestedAmountCents: topUp.requestedAmountCents,
      discountCents: topUp.discountCents,
      creditsGranted: topUp.creditsGranted,
      autoTopUpEnabled,
      autoTopUpThresholdCents,
      currency,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create Stripe checkout session";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
