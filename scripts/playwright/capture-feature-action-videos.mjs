import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
  DESKTOP_VIEWPORT,
  ensureDir,
  installCinematicHarness,
  parseBoolean,
  parseCliArgs,
  saveRecordedVideo,
  timestampTag,
} from "./landing-capture-lib.mjs";

const args = parseCliArgs();
const baseUrl =
  String(args["base-url"] || process.env.LANDING_CAPTURE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "") + "/";

const headless = parseBoolean(args.headless ?? process.env.LANDING_CAPTURE_HEADLESS, true);
const includeCombined = parseBoolean(args.combined ?? process.env.LANDING_CAPTURE_COMBINED, true);
const parsedGotoTimeoutMs = Number(
  args["goto-timeout-ms"] || process.env.LANDING_CAPTURE_GOTO_TIMEOUT_MS || 90_000,
);
const gotoTimeoutMs = Number.isFinite(parsedGotoTimeoutMs) ? parsedGotoTimeoutMs : 90_000;

const dashboardStorageStatePath = String(
  args["dashboard-storage-state"] || process.env.LANDING_CAPTURE_DASHBOARD_STORAGE_STATE || "",
).trim();

const requestedFeatures = String(args.features || "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const outRoot = path.resolve(
  process.cwd(),
  String(args["out-dir"] || "artifacts/landing-capture/videos/feature-actions"),
  timestampTag(),
);
const tmpVideoDir = path.join(outRoot, ".tmp");

const TIMING = {
  hoverMinMs: 500,
  hoverMaxMs: 1000,
  clickMinMs: 1000,
  clickMaxMs: 2000,
  highlightMinMs: 1000,
  highlightMaxMs: 2000,
  gapMinMs: 200,
  gapMaxMs: 400,
};

function randInt(min, max) {
  if (max <= min) {
    return min;
  }

  return Math.round(min + Math.random() * (max - min));
}

function toRoute(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function gotoAndPrime(page, pathname) {
  await page.goto(toRoute(pathname), {
    waitUntil: "domcontentloaded",
    timeout: gotoTimeoutMs,
  });

  try {
    await page.waitForLoadState("networkidle", { timeout: 12_000 });
  } catch {
    // Keep progressing when background requests keep the page busy.
  }

  await installCinematicHarness(page);
  await installFeatureStyles(page);
  await page.waitForTimeout(220);
}

async function installFeatureStyles(page) {
  await page.addStyleTag({
    content: `
      .landing-cinema-highlight-target {
        position: relative;
        outline: 2px solid rgba(34, 197, 94, 0.9) !important;
        outline-offset: 3px;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.16), 0 20px 42px rgba(15, 23, 42, 0.24);
        border-radius: 10px;
      }

      .landing-cinema-action-chip {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483642;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(30, 41, 59, 0.14);
        background: rgba(248, 250, 252, 0.96);
        color: #0f172a;
        font: 600 11px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0.01em;
        box-shadow: 0 12px 30px rgba(2, 6, 23, 0.2);
        transform: translateY(6px);
        opacity: 0;
        transition: opacity 220ms ease, transform 220ms ease;
        pointer-events: none;
      }
    `,
  });

  await page.evaluate(() => {
    if (!document.getElementById("landing-cinema-action-chip")) {
      const chip = document.createElement("div");
      chip.id = "landing-cinema-action-chip";
      chip.className = "landing-cinema-action-chip";
      chip.textContent = "Action";
      document.body.appendChild(chip);
    }
  });
}

async function humanGap(page) {
  await page.waitForTimeout(randInt(TIMING.gapMinMs, TIMING.gapMaxMs));
}

async function resolveVisibleLocator(page, selectors, timeoutMs = 6_000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return locator;
    } catch {
      // Continue through fallback selectors.
    }
  }

  return null;
}

async function showActionChip(page, text, position) {
  await page.evaluate(
    ({ label, x, y }) => {
      const chip = document.getElementById("landing-cinema-action-chip");
      if (!chip) {
        return;
      }

      chip.textContent = label;
      chip.style.left = `${Math.max(12, Math.min(window.innerWidth - 260, x + 12))}px`;
      chip.style.top = `${Math.max(12, Math.min(window.innerHeight - 80, y - 44))}px`;
      chip.style.opacity = "1";
      chip.style.transform = "translateY(0)";
    },
    {
      label: text,
      x: position.x,
      y: position.y,
    },
  );
}

async function hideActionChip(page) {
  await page.evaluate(() => {
    const chip = document.getElementById("landing-cinema-action-chip");
    if (!chip) {
      return;
    }

    chip.style.opacity = "0";
    chip.style.transform = "translateY(6px)";
  });
}

async function highlightLocator(page, locator, holdMs) {
  const handle = await locator.elementHandle();
  if (!handle) {
    await page.waitForTimeout(holdMs);
    return;
  }

  await page.evaluate((el) => {
    const active = document.querySelectorAll(".landing-cinema-highlight-target");
    active.forEach((node) => node.classList.remove("landing-cinema-highlight-target"));
    el.classList.add("landing-cinema-highlight-target");
  }, handle);

  await page.waitForTimeout(holdMs);

  await page.evaluate((el) => {
    el.classList.remove("landing-cinema-highlight-target");
  }, handle);
}

async function moveCursorToLocator(page, locator, durationMs) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);

  const box = await locator.boundingBox();
  if (!box) {
    return null;
  }

  const point = {
    x: box.x + box.width * 0.5 + randInt(-10, 10),
    y: box.y + Math.min(Math.max(box.height * 0.45, 12), Math.max(14, box.height - 8)) + randInt(-8, 8),
  };

  await page.evaluate(
    async ({ x, y, duration }) => {
      const state = window.__landingCinema;
      if (!state?.cursor) {
        return;
      }

      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
      const startX = state.x ?? 72;
      const startY = state.y ?? 92;
      const startTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const progress = Math.min(1, (now - startTime) / Math.max(1, duration));
          const eased = ease(progress);

          state.x = startX + (x - startX) * eased;
          state.y = startY + (y - startY) * eased;
          state.cursor.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;

          if (progress < 1) {
            requestAnimationFrame(tick);
            return;
          }

          resolve();
        };

        requestAnimationFrame(tick);
      });
    },
    {
      x: point.x,
      y: point.y,
      duration: durationMs,
    },
  );

  return point;
}

async function rippleAt(page, point) {
  await page.evaluate(({ x, y }) => {
    const ripple = document.createElement("div");
    ripple.className = "landing-cinema-ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    ripple.animate(
      [
        { transform: "translate3d(-50%, -50%, 0) scale(0.1)", opacity: 0.8 },
        { transform: "translate3d(-50%, -50%, 0) scale(2.0)", opacity: 0 },
      ],
      {
        duration: 460,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    setTimeout(() => ripple.remove(), 520);
  }, point);
}

async function zoomAt(page, point) {
  await page.evaluate(
    async ({ x, y }) => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const stage = document.querySelector("main") || document.body;
      if (!stage) {
        return;
      }

      const previousTransition = stage.style.transition;
      const previousTransform = stage.style.transform;
      const previousOrigin = stage.style.transformOrigin;
      const previousWillChange = stage.style.willChange;

      stage.style.willChange = "transform";
      stage.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
      stage.style.transition = "transform 190ms cubic-bezier(0.22, 1, 0.36, 1)";
      stage.style.transform = "scale(1.035)";
      await wait(170);
      stage.style.transform = "scale(1)";
      await wait(190);

      stage.style.transition = previousTransition;
      stage.style.transform = previousTransform;
      stage.style.transformOrigin = previousOrigin;
      stage.style.willChange = previousWillChange;
    },
    point,
  );
}

async function hoverAction(page, selectors, label) {
  const locator = await resolveVisibleLocator(page, selectors);
  if (!locator) {
    return false;
  }

  const point = await moveCursorToLocator(page, locator, randInt(560, 900));
  if (!point) {
    return false;
  }

  await locator.hover();
  await showActionChip(page, label, point);
  await highlightLocator(page, locator, randInt(TIMING.hoverMinMs, TIMING.hoverMaxMs));
  await hideActionChip(page);
  await humanGap(page);
  return true;
}

async function clickAction(page, selectors, label) {
  const locator = await resolveVisibleLocator(page, selectors);
  if (!locator) {
    return false;
  }

  const point = await moveCursorToLocator(page, locator, randInt(620, 960));
  if (!point) {
    return false;
  }

  await locator.click({ delay: randInt(40, 90) });
  await Promise.all([rippleAt(page, point), zoomAt(page, point)]);
  await showActionChip(page, label, point);
  await page.waitForTimeout(randInt(TIMING.clickMinMs, TIMING.clickMaxMs));
  await hideActionChip(page);
  await humanGap(page);
  return true;
}

async function fillAction(page, selectors, value, label) {
  const locator = await resolveVisibleLocator(page, selectors);
  if (!locator) {
    return false;
  }

  const point = await moveCursorToLocator(page, locator, randInt(560, 860));
  if (!point) {
    return false;
  }

  await locator.click({ delay: randInt(40, 90) });
  await Promise.all([rippleAt(page, point), zoomAt(page, point)]);
  await locator.fill(value);
  await showActionChip(page, label, point);
  await highlightLocator(page, locator, randInt(TIMING.highlightMinMs, TIMING.highlightMaxMs));
  await hideActionChip(page);
  await humanGap(page);
  return true;
}

async function fireOpenApiProbe(page, selectorCandidates) {
  const locator = await resolveVisibleLocator(page, selectorCandidates);
  if (!locator) {
    return false;
  }

  const point = await moveCursorToLocator(page, locator, randInt(560, 900));
  if (!point) {
    return false;
  }

  const probeResult = await page.evaluate(async () => {
    const payload = {
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: "Say hello in one short sentence." }],
    };

    try {
      const response = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer demo-openai-client-key",
        },
        body: JSON.stringify(payload),
      });

      return {
        status: response.status,
      };
    } catch {
      return {
        status: null,
      };
    }
  });

  const statusLabel = probeResult.status === null ? "request blocked" : `status ${probeResult.status}`;
  await Promise.all([rippleAt(page, point), zoomAt(page, point)]);
  await showActionChip(page, `OpenAI config -> /v1/chat/completions (${statusLabel})`, point);
  await highlightLocator(page, locator, randInt(1200, 1700));
  await hideActionChip(page);
  await humanGap(page);

  return true;
}

async function assertDashboardSession(page) {
  const currentUrl = page.url();
  if (currentUrl.includes("/login") || currentUrl.includes("/register")) {
    throw new Error(
      "Dashboard capture requires an authenticated Playwright storageState fixture. Provide --dashboard-storage-state.",
    );
  }
}

async function storyMarketingFeatures(page) {
  await gotoAndPrime(page, "/use-cases/text-to-image");

  await hoverAction(page, ["[data-route-hero] h1"], "Feature page hero");
  await clickAction(page, ["[data-route-section] [data-route-card]"], "Open feature card");
  await hoverAction(page, ["[data-route-card-cta]"], "Feature CTA");
}

async function storyMarketingModels(page) {
  await gotoAndPrime(page, "/models");

  await hoverAction(page, ["[data-route-hero] h1"], "Marketing models catalog");
  await clickAction(page, ["[data-route-section='modalities'] [data-route-card='modalities-card-1']", "[data-route-card]"], "Inspect model modality card");
  await hoverAction(page, ["[data-route-section='selection'] [data-route-card='selection-card-2']", "[data-route-card-cta]"], "Model selection guidance");
}

async function storyComprehensivePricing(page) {
  await gotoAndPrime(page, "/pricing");

  await hoverAction(page, ["[data-pricing-billing='annual']"], "Annual pricing toggle");
  await clickAction(page, ["[data-pricing-billing='annual']"], "Apply annual plan pricing");
  await hoverAction(page, ["[data-pricing-plan='growth']", "[data-pricing-plan='scale']"], "Compare plan card details");
  await clickAction(page, ["[data-pricing-billing='monthly']"], "Switch back to monthly");
}

async function storyPlayground(page) {
  await gotoAndPrime(page, "/playground");

  await hoverAction(page, ["[data-playground-category-link='Text → Image']", "[data-playground-category-link]"] , "Playground category picker");
  await clickAction(page, ["[data-playground-tab='json']"], "View JSON payload shape");
  await clickAction(page, ["[data-playground-tab='curl']"], "View cURL preview");
  await clickAction(page, ["[data-playground-action='generate']"], "Trigger generate flow");
}

async function storyDocsAndOpenApi(page) {
  await gotoAndPrime(page, "/docs/v1/openapi");

  await hoverAction(page, ["a[href='/openapi.json']"], "Machine-readable OpenAPI schema");
  await clickAction(page, ["aside:has-text('Live API Preview') button:has-text('python')"], "Switch OpenAI client example to Python");
  await clickAction(page, ["aside:has-text('Live API Preview') button:has-text('js')"], "Switch OpenAI client example to JavaScript");

  try {
    await gotoAndPrime(page, "/docs/v1/api-reference/openai-compatible");
    await hoverAction(page, ["#queue-a-chat-completion-request", "text=Queue a chat completion request"], "OpenAI-compatible endpoint docs");
    await fireOpenApiProbe(page, ["#queue-a-chat-completion-request", "text=/v1/chat/completions"]);
  } catch {
    // Fallback to the OpenAPI page when deep reference routes are unavailable in local preview.
    await gotoAndPrime(page, "/docs/v1/openapi");
    await hoverAction(page, ["aside:has-text('Live API Preview')", "text=Live API Preview"], "OpenAPI preview panel");
    await fireOpenApiProbe(page, ["aside:has-text('Live API Preview')", "text=/v1/chat/completions"]);
  }
}

async function storyDashboardOrganization(page) {
  await gotoAndPrime(page, "/dashboard/settings/organization");
  await assertDashboardSession(page);

  await hoverAction(page, ["text=Your workspaces"], "Workspace management panel");
  await fillAction(page, ["#organization-name"], "Capture Fixture Workspace", "Type workspace name");
  await fillAction(page, ["#organization-slug"], "capture-fixture-workspace", "Adjust workspace slug");
}

const storyCatalog = {
  "marketing-features": {
    title: "marketing-features",
    requiresAuth: false,
    run: storyMarketingFeatures,
  },
  "marketing-models": {
    title: "marketing-models",
    requiresAuth: false,
    run: storyMarketingModels,
  },
  "comprehensive-pricing": {
    title: "comprehensive-pricing",
    requiresAuth: false,
    run: storyComprehensivePricing,
  },
  playground: {
    title: "playground-actions",
    requiresAuth: false,
    run: storyPlayground,
  },
  "docs-openapi": {
    title: "docs-openapi-openai-config",
    requiresAuth: false,
    run: storyDocsAndOpenApi,
  },
  "dashboard-organization": {
    title: "dashboard-organization-management",
    requiresAuth: true,
    run: storyDashboardOrganization,
  },
};

const featureAliases = {
  "org-management": "dashboard-organization",
  "marketing-pricing": "comprehensive-pricing",
  pricing: "comprehensive-pricing",
  models: "marketing-models",
  features: "marketing-features",
  openapi: "docs-openapi",
  docs: "docs-openapi",
  "openapi-openai": "docs-openapi",
};

function normalizeRequestedFeature(value) {
  if (value in storyCatalog) {
    return value;
  }

  return featureAliases[value] || value;
}

function buildDefaultStoryKeys() {
  const defaults = [
    "marketing-features",
    "marketing-models",
    "comprehensive-pricing",
    "playground",
    "docs-openapi",
  ];

  if (dashboardStorageStatePath) {
    defaults.unshift("dashboard-organization");
  }

  return defaults;
}

function selectStoryKeys() {
  const defaults = buildDefaultStoryKeys();

  if (requestedFeatures.length === 0) {
    return defaults;
  }

  const mapped = requestedFeatures
    .map(normalizeRequestedFeature)
    .filter((key) => key in storyCatalog);

  return mapped.length > 0 ? mapped : defaults;
}

async function ensureDashboardFixtureAvailable() {
  if (!dashboardStorageStatePath) {
    throw new Error(
      "Dashboard story requires authenticated fixture state. Pass --dashboard-storage-state <path-to-storageState.json>.",
    );
  }

  await fs.access(path.resolve(process.cwd(), dashboardStorageStatePath));
}

async function createRecordingContext(browser, requiresAuth) {
  const contextOptions = {
    viewport: DESKTOP_VIEWPORT,
    recordVideo: {
      dir: tmpVideoDir,
      size: DESKTOP_VIEWPORT,
    },
  };

  if (!requiresAuth) {
    return browser.newContext(contextOptions);
  }

  await ensureDashboardFixtureAvailable();

  return browser.newContext({
    ...contextOptions,
    storageState: path.resolve(process.cwd(), dashboardStorageStatePath),
  });
}

async function recordStory(browser, storyKey, filePrefix) {
  const story = storyCatalog[storyKey];
  const context = await createRecordingContext(browser, story.requiresAuth);
  const page = await context.newPage();

  try {
    await story.run(page);
    await page.waitForTimeout(300);

    const filePath = path.join(outRoot, `${filePrefix}-${story.title}.webm`);
    return await saveRecordedVideo(context, page, filePath);
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function recordCombined(browser, selectedStoryKeys) {
  const marketingKeys = selectedStoryKeys.filter((key) => !storyCatalog[key].requiresAuth);
  if (marketingKeys.length < 2) {
    return null;
  }

  const context = await createRecordingContext(browser, false);
  const page = await context.newPage();

  try {
    const keys = marketingKeys.slice(0, 4);
    for (const key of keys) {
      await storyCatalog[key].run(page);
      await page.waitForTimeout(randInt(210, 320));
    }

    await page.waitForTimeout(320);
    const filePath = path.join(outRoot, "00-combined-feature-reel.webm");
    return await saveRecordedVideo(context, page, filePath);
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function main() {
  await ensureDir(outRoot);
  await ensureDir(tmpVideoDir);

  const browser = await chromium.launch({ headless });
  const outputs = [];

  try {
    const selectedStoryKeys = selectStoryKeys();

    for (const storyKey of selectedStoryKeys) {
      if (storyCatalog[storyKey].requiresAuth) {
        await ensureDashboardFixtureAvailable();
      }
    }

    for (let index = 0; index < selectedStoryKeys.length; index += 1) {
      const storyKey = selectedStoryKeys[index];
      const filePrefix = `${String(index + 1).padStart(2, "0")}`;
      const output = await recordStory(browser, storyKey, filePrefix);
      if (output) {
        outputs.push(output);
      }
    }

    if (includeCombined) {
      const combined = await recordCombined(browser, selectedStoryKeys);
      if (combined) {
        outputs.push(combined);
      }
    }

    console.log(`Captured ${outputs.length} feature action videos into ${outRoot}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to capture feature action videos", error);
  process.exitCode = 1;
});
