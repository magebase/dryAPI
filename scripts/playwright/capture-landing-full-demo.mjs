import path from "node:path";
import { chromium } from "playwright";

import {
  DESKTOP_VIEWPORT,
  collectLandingSlots,
  ensureDir,
  gotoLandingPage,
  installCinematicHarness,
  moveToTop,
  parseBoolean,
  parseCliArgs,
  parseNumber,
  playCinematicShot,
  saveRecordedVideo,
  timestampTag,
} from "./landing-capture-lib.mjs";

const args = parseCliArgs();
const baseUrl =
  String(args["base-url"] || process.env.LANDING_CAPTURE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "") + "/";

const headless = parseBoolean(args.headless ?? process.env.LANDING_CAPTURE_HEADLESS, true);
const demoCount = Math.max(1, parseNumber(args["demo-count"] ?? process.env.LANDING_DEMO_COUNT, 3));
const maxSlots = parseNumber(args["max-slots"], Number.POSITIVE_INFINITY);
const outRoot = path.resolve(
  process.cwd(),
  String(args["out-dir"] || "artifacts/landing-capture/videos/full-demo"),
  timestampTag(),
);
const tmpVideoDir = path.join(outRoot, ".tmp");

function buildFlows(slots) {
  const ordered = [...slots];
  const odds = ordered.filter((_, index) => index % 2 === 0);
  const evens = ordered.filter((_, index) => index % 2 === 1);

  return [
    { name: "flow-forward", slots: ordered },
    { name: "flow-odds-first", slots: [...odds, ...evens] },
    { name: "flow-reverse", slots: [...ordered].reverse() },
  ];
}

async function discoverSlots(browser) {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();

  await gotoLandingPage(page, baseUrl);
  const slots = await collectLandingSlots(page);

  await context.close();
  return slots;
}

async function recordFlow(browser, flow, index) {
  const context = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    recordVideo: {
      dir: tmpVideoDir,
      size: DESKTOP_VIEWPORT,
    },
  });

  const page = await context.newPage();

  await gotoLandingPage(page, baseUrl);
  await installCinematicHarness(page);
  await moveToTop(page, 600);

  for (let slotIndex = 0; slotIndex < flow.slots.length; slotIndex += 1) {
    const slot = flow.slots[slotIndex];
    const selector = `#${slot.id}`;

    await playCinematicShot(page, selector, {
      zoom: 1.1 + (slotIndex % 3) * 0.03,
      blurPx: 2 + (slotIndex % 2) * 0.6,
      scrollDurationMs: 700 + slotIndex * 14,
      trackDurationMs: 760 + (slotIndex % 4) * 90,
      preClickHoldMs: 320 + (slotIndex % 3) * 80,
      settleMs: 360 + (slotIndex % 3) * 70,
      callout: slot.title || slot.slot,
      scrollPaddingTop: 92,
    });

    await page.waitForTimeout(260);
  }

  await page.waitForTimeout(720);

  const filePath = path.join(
    outRoot,
    `landing-full-demo-${String(index + 1).padStart(2, "0")}-${flow.name}.webm`,
  );

  return saveRecordedVideo(context, page, filePath);
}

async function main() {
  await ensureDir(outRoot);
  await ensureDir(tmpVideoDir);

  const browser = await chromium.launch({ headless });

  try {
    const discoveredSlots = await discoverSlots(browser);
    if (discoveredSlots.length === 0) {
      throw new Error("No [data-landing-slot] sections found on the landing page.");
    }

    const slots = discoveredSlots.slice(
      0,
      Number.isFinite(maxSlots) ? maxSlots : discoveredSlots.length,
    );

    const flows = buildFlows(slots);
    const targetFlows = Array.from({ length: demoCount }, (_, idx) => flows[idx % flows.length]);

    const outputVideos = [];
    for (let index = 0; index < targetFlows.length; index += 1) {
      const videoPath = await recordFlow(browser, targetFlows[index], index);
      if (videoPath) {
        outputVideos.push(videoPath);
      }
    }

    console.log(`Captured ${outputVideos.length} full cinematic demos into ${outRoot}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to capture full cinematic landing demo", error);
  process.exitCode = 1;
});
