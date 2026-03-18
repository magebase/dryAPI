// @ts-nocheck
import path from "node:path";
import { chromium } from "playwright";

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  collectLandingSlots,
  ensureDir,
  gotoLandingPage,
  labelForSlot,
  parseBoolean,
  parseCliArgs,
  timestampTag,
} from "./landing-capture-lib";

const args = parseCliArgs();
const baseUrl =
  String(args["base-url"] || process.env.LANDING_CAPTURE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "") + "/";

const includeMobile = parseBoolean(args.mobile ?? process.env.LANDING_CAPTURE_MOBILE, true);
const includeDesktop = parseBoolean(args.desktop ?? process.env.LANDING_CAPTURE_DESKTOP, true);
const headless = parseBoolean(args.headless ?? process.env.LANDING_CAPTURE_HEADLESS, true);
const outRoot = path.resolve(
  process.cwd(),
  String(args["out-dir"] || "artifacts/landing-capture/screenshots"),
  timestampTag(),
);

if (!includeDesktop && !includeMobile) {
  throw new Error("Nothing to capture: both desktop and mobile were disabled.");
}

async function captureViewport(browser, profile) {
  const context = await browser.newContext({ viewport: profile.viewport });
  const page = await context.newPage();

  await gotoLandingPage(page, baseUrl);
  const slots = await collectLandingSlots(page);

  if (slots.length === 0) {
    throw new Error("No [data-landing-slot] sections found on the landing page.");
  }

  const targetDir = path.join(outRoot, profile.name);
  await ensureDir(targetDir);

  const captured = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const selector = `#${slot.id}`;
    const label = labelForSlot(slot, index);
    const filePath = path.join(targetDir, `${label}.png`);

    await page.evaluate((slotSelector) => {
      const el = document.querySelector(slotSelector);
      el?.scrollIntoView({ behavior: "auto", block: "start" });
    }, selector);

    await page.waitForTimeout(profile.pauseMs);
    await page.locator(selector).screenshot({ path: filePath });
    captured.push(filePath);
  }

  const fullPath = path.join(targetDir, `00-full-page-${profile.name}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  captured.push(fullPath);

  await context.close();
  return captured;
}

async function main() {
  await ensureDir(outRoot);

  const browser = await chromium.launch({ headless });

  try {
    const profiles = [];
    if (includeDesktop) {
      profiles.push({
        name: "desktop",
        viewport: DESKTOP_VIEWPORT,
        pauseMs: 240,
      });
    }

    if (includeMobile) {
      profiles.push({
        name: "mobile",
        viewport: MOBILE_VIEWPORT,
        pauseMs: 280,
      });
    }

    const allPaths = [];
    for (const profile of profiles) {
      const files = await captureViewport(browser, profile);
      allPaths.push(...files);
    }

    console.log(`Captured ${allPaths.length} screenshots into ${outRoot}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to capture landing screenshots", error);
  process.exitCode = 1;
});
