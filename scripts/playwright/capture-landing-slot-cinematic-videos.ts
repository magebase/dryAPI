// @ts-nocheck
import path from "node:path";
import { chromium } from "playwright";

import {
  DESKTOP_VIEWPORT,
  collectLandingSlots,
  ensureDir,
  gotoLandingPage,
  installCinematicHarness,
  labelForSlot,
  moveToTop,
  parseBoolean,
  parseCliArgs,
  parseNumber,
  playCinematicShot,
  saveRecordedVideo,
  timestampTag,
} from "./landing-capture-lib";

const args = parseCliArgs();
const baseUrl =
  String(args["base-url"] || process.env.LANDING_CAPTURE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "") + "/";

const headless = parseBoolean(args.headless ?? process.env.LANDING_CAPTURE_HEADLESS, true);
const maxSlots = parseNumber(args["max-slots"], Number.POSITIVE_INFINITY);
const variations = Math.max(1, parseNumber(args.variations ?? process.env.LANDING_CAPTURE_VARIATIONS, 2));
const outRoot = path.resolve(
  process.cwd(),
  String(args["out-dir"] || "artifacts/landing-capture/videos/slots"),
  timestampTag(),
);
const tmpVideoDir = path.join(outRoot, ".tmp");

const cinematicVariants = [
  {
    name: "track-a",
    zoom: 1.12,
    blurPx: 2,
    scrollDurationMs: 700,
    trackDurationMs: 740,
    preClickHoldMs: 340,
    settleMs: 420,
  },
  {
    name: "track-b",
    zoom: 1.17,
    blurPx: 2.6,
    scrollDurationMs: 800,
    trackDurationMs: 860,
    preClickHoldMs: 420,
    settleMs: 520,
  },
  {
    name: "track-c",
    zoom: 1.14,
    blurPx: 1.9,
    scrollDurationMs: 760,
    trackDurationMs: 920,
    preClickHoldMs: 380,
    settleMs: 500,
  },
];

async function discoverSlots(browser) {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();

  await gotoLandingPage(page, baseUrl);
  const slots = await collectLandingSlots(page);

  await context.close();
  return slots;
}

async function captureSlotVariant(browser, slot, slotIndex, variant, variantIndex) {
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
  await moveToTop(page, 380);

  const selector = `#${slot.id}`;
  const slotLabel = slot.title || slot.slot || `Slot ${slotIndex + 1}`;

  await playCinematicShot(page, selector, {
    ...variant,
    callout: slotLabel,
    scrollPaddingTop: 94,
  });

  await page.waitForTimeout(380 + variantIndex * 80);

  const fileStem = `${labelForSlot(slot, slotIndex)}-v${variantIndex + 1}-${variant.name}`;
  const targetPath = path.join(outRoot, `${fileStem}.webm`);
  const videoPath = await saveRecordedVideo(context, page, targetPath);

  return videoPath;
}

async function main() {
  await ensureDir(outRoot);
  await ensureDir(tmpVideoDir);

  const browser = await chromium.launch({ headless });

  try {
    const slots = await discoverSlots(browser);
    if (slots.length === 0) {
      throw new Error("No [data-landing-slot] sections found on the landing page.");
    }

    const limitedSlots = slots.slice(0, Number.isFinite(maxSlots) ? maxSlots : slots.length);

    const emitted = [];

    for (let slotIndex = 0; slotIndex < limitedSlots.length; slotIndex += 1) {
      const slot = limitedSlots[slotIndex];

      for (let variantIndex = 0; variantIndex < variations; variantIndex += 1) {
        const variant = cinematicVariants[variantIndex % cinematicVariants.length];
        const videoPath = await captureSlotVariant(
          browser,
          slot,
          slotIndex,
          variant,
          variantIndex,
        );

        if (videoPath) {
          emitted.push(videoPath);
        }
      }
    }

    console.log(`Captured ${emitted.length} cinematic slot videos into ${outRoot}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Failed to capture cinematic slot videos", error);
  process.exitCode = 1;
});
