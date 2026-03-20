import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SuccessFlowPage from "./[flow]/page";
import { resolveSuccessPageFlow } from "./success-utils";

vi.mock("@/lib/og/metadata", () => ({
  buildTakumiMetadata: vi.fn(),
}));

vi.mock("@/lib/site-content-loader", async () => {
  return {
    readSiteConfig: vi.fn().mockResolvedValue({
      brand: {
        name: "dryAPI",
        mark: "dryAPI",
      },
      contact: {
        contactEmail: "support@dryapi.dev",
      },
    }),
  };
});

describe("resolveSuccessPageFlow", () => {
  it("honors the explicit flow query when present", () => {
    expect(
      resolveSuccessPageFlow({
        flow: "topup",
        session_id: "cs_test_123abc",
      }),
    ).toBe("topup");
  });

  it("treats a valid Stripe checkout session id as a top-up", () => {
    expect(
      resolveSuccessPageFlow({
        session_id: "cs_test_123abc",
      }),
    ).toBe("topup");
  });

  it("keeps the subscription flow when no checkout session id is present", () => {
    expect(
      resolveSuccessPageFlow({
        flow: "subscription",
      }),
    ).toBe("subscription");
  });

  it("falls back to top-up when only a checkout session id is present", () => {
    expect(
      resolveSuccessPageFlow({
        session_id: "cs_test_123abc",
      }),
    ).toBe("topup");
  });

  it("renders explicit top-up wording for the top-up success flow", async () => {
    const element = await SuccessFlowPage({
      params: Promise.resolve({ flow: "topup" }),
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Top-up successful");
    expect(html).toContain("Top-up complete");
    expect(html).toContain(
      "Top-up credits should appear in your billing dashboard shortly.",
    );
    expect(html).toContain(
      "Charges may appear as DRYAPI*ADSTIM and are processed by AdStim LLC.",
    );
  });
});
