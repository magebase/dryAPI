import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type ServicePackageTier = {
  id: string;
  displayName?: string;
  priceMonthly?: number;
  setupFeeOneTime?: number;
  targetSetupWindowHours: string;
  includes: string[];
  analytics: {
    microsoftClarity: boolean;
  };
};

type ServicePackagesCatalog = {
  tiers: ServicePackageTier[];
  crmOptions: string[];
  addOns: Array<{
    id: string;
    label: string;
    priceMonthly: number;
    unit?: string;
    note?: string;
    model?: string;
    platform?: string;
    billing?: string;
  }>;
};

type WorkflowCatalog = {
  implementedFlowKinds: string[];
  proOnlyTemplates: Array<{
    id: string;
    trigger: string;
    value: string;
  }>;
};

const scriptPath = path.resolve(process.cwd(), "scripts/cf-client-init.sh");
const scaffoldScript = fs.readFileSync(scriptPath, "utf8");

function extractClientHeredoc(targetFileName: string): string {
  const marker = `cat > "\${client_dir}/${targetFileName}" <<EOF`;
  const markerIndex = scaffoldScript.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Missing heredoc marker for ${targetFileName}`);
  }

  const contentStart = scaffoldScript.indexOf("\n", markerIndex);
  if (contentStart === -1) {
    throw new Error(`Failed to find heredoc content start for ${targetFileName}`);
  }

  const contentEnd = scaffoldScript.indexOf("\nEOF", contentStart + 1);
  if (contentEnd === -1) {
    throw new Error(`Failed to find heredoc content end for ${targetFileName}`);
  }

  return scaffoldScript.slice(contentStart + 1, contentEnd).trim();
}

function parseEnvDocument(document: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const line of document.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

function parseSetupWindow(window: string): [number, number] {
  const [start, end] = window.split("-").map((value) => Number(value));
  return [start, end];
}

const servicePackages = JSON.parse(
  extractClientHeredoc("service-packages.json")
) as ServicePackagesCatalog;
const workflowCatalog = JSON.parse(
  extractClientHeredoc("cloudflare-workflow-catalog.json")
) as WorkflowCatalog;
const siteWranglerTemplate = extractClientHeredoc("wrangler.site.jsonc");
const automationEnvDefaults = parseEnvDocument(extractClientHeredoc("automation.env.example"));

describe("tiered plan scaffold policy", () => {
  it("declares exactly three tiers in ascending order", () => {
    expect(servicePackages.tiers.map((tier) => tier.id)).toEqual(["basic", "growth", "pro"]);
    expect(servicePackages.tiers.map((tier) => tier.displayName)).toEqual(["Starter", "Growth", "Pro"]);
  });

  it("keeps setup windows increasing by tier", () => {
    const windows = servicePackages.tiers.map((tier) => parseSetupWindow(tier.targetSetupWindowHours));
    expect(windows.every(([start, end]) => Number.isFinite(start) && Number.isFinite(end))).toBe(true);
    expect(windows.every(([start, end]) => start < end)).toBe(true);
    expect(windows[0][0]).toBeLessThan(windows[1][0]);
    expect(windows[1][0]).toBeLessThan(windows[2][0]);
  });

  it("requires Microsoft Clarity for non-basic tiers only", () => {
    const analyticsByTier = new Map(servicePackages.tiers.map((tier) => [tier.id, tier.analytics.microsoftClarity]));
    expect(analyticsByTier.get("basic")).toBe(false);
    expect(analyticsByTier.get("growth")).toBe(true);
    expect(analyticsByTier.get("pro")).toBe(true);
  });

  it("keeps include lists non-empty across all tiers", () => {
    expect(servicePackages.tiers.every((tier) => tier.includes.length > 0)).toBe(true);
  });

  it("pins monthly prices and setup fees to the revenue model", () => {
    const byTier = new Map(servicePackages.tiers.map((tier) => [tier.id, tier]));

    expect(byTier.get("basic")?.priceMonthly).toBe(89);
    expect(byTier.get("growth")?.priceMonthly).toBe(279);
    expect(byTier.get("pro")?.priceMonthly).toBe(599);

    expect(byTier.get("basic")?.setupFeeOneTime).toBe(0);
    expect(byTier.get("growth")?.setupFeeOneTime).toBe(99);
    expect(byTier.get("pro")?.setupFeeOneTime).toBe(149);
  });

  it("exposes workflow automation in growth and pro package copy", () => {
    const growth = servicePackages.tiers.find((tier) => tier.id === "growth");
    const pro = servicePackages.tiers.find((tier) => tier.id === "pro");

    expect(growth?.includes.some((item) => item.includes("Cloudflare Workflow"))).toBe(true);
    expect(pro?.includes.some((item) => item.includes("Cloudflare Workflow automations"))).toBe(true);
  });

  it("keeps multi-seat inclusion scoped to pro copy", () => {
    const basic = servicePackages.tiers.find((tier) => tier.id === "basic");
    const growth = servicePackages.tiers.find((tier) => tier.id === "growth");
    const pro = servicePackages.tiers.find((tier) => tier.id === "pro");

    expect(basic?.includes.some((item) => item.toLowerCase().includes("multi-seat"))).toBe(false);
    expect(growth?.includes.some((item) => item.toLowerCase().includes("multi-seat"))).toBe(false);
    expect(pro?.includes.some((item) => item.toLowerCase().includes("multi-seat"))).toBe(true);
  });

  it("pins CRM provider options to the supported trio", () => {
    expect(servicePackages.crmOptions).toEqual(["hubspot", "salesforce", "zoho"]);
  });

  it("declares unique add-ons with positive monthly prices", () => {
    const addOnIds = servicePackages.addOns.map((item) => item.id);
    expect(new Set(addOnIds).size).toBe(addOnIds.length);
    expect(servicePackages.addOns.every((item) => item.priceMonthly > 0)).toBe(true);
  });

  it("keeps AI add-on implementation details stable", () => {
    const autoblogger = servicePackages.addOns.find((item) => item.id === "automatic-blog-daily");
    const advancedChatbot = servicePackages.addOns.find((item) => item.id === "ai-chatbot");

    expect(autoblogger?.model).toBe("gemini-3-flash");
    expect(advancedChatbot?.platform).toBe("cloudflare-ai-search");
    expect(advancedChatbot?.billing).toBe("flat-rate");
  });

  it("sets automation env defaults to pro tier with optional clarity id", () => {
    expect(automationEnvDefaults.NEXT_PUBLIC_PLAN_TIER).toBe("pro");
    expect(automationEnvDefaults).toHaveProperty("NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID");
    expect(automationEnvDefaults).toHaveProperty("FEATURE_AI_CHATBOT_ENABLED", "true");
    expect(automationEnvDefaults).toHaveProperty("FEATURE_STRIPE_DEPOSITS_ENABLED", "false");
    expect(automationEnvDefaults).toHaveProperty("NEXT_PUBLIC_FEATURE_INTERNATIONALIZATION_ENABLED", "false");
    expect(automationEnvDefaults).toHaveProperty("FEATURE_CRM_DASHBOARD_ENABLED", "true");
    expect(automationEnvDefaults).toHaveProperty("FEATURE_WORKFLOW_AUTOMATIONS_ENABLED", "true");
  });

  it("keeps site worker vars defaulting to basic tier", () => {
    expect(siteWranglerTemplate).toContain('"NEXT_PUBLIC_PLAN_TIER": "basic"');
    expect(siteWranglerTemplate).toContain('"NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID": ""');
    expect(siteWranglerTemplate).toContain('"NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED": "true"');
    expect(siteWranglerTemplate).toContain('"NEXT_PUBLIC_FEATURE_STRIPE_DEPOSITS_ENABLED": "false"');
    expect(siteWranglerTemplate).toContain('"NEXT_PUBLIC_FEATURE_INTERNATIONALIZATION_ENABLED": "false"');
  });

  it("keeps pro workflow templates unique", () => {
    const ids = workflowCatalog.proOnlyTemplates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ensures pro templates are implemented flow kinds", () => {
    const implemented = new Set(workflowCatalog.implementedFlowKinds);
    for (const template of workflowCatalog.proOnlyTemplates) {
      expect(implemented.has(template.id)).toBe(true);
    }
  });

  it("retains KPI sync flow in both implemented and pro template sets", () => {
    expect(workflowCatalog.implementedFlowKinds).toContain("internal-kpi-dashboard-sync");
    expect(workflowCatalog.proOnlyTemplates.some((template) => template.id === "internal-kpi-dashboard-sync")).toBe(true);
  });
});
