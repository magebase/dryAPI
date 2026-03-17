import fs from "node:fs/promises";
import path from "node:path";

export const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
export const MOBILE_VIEWPORT = { width: 430, height: 932 };

export function timestampTag(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function parseBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function parseNumber(value, fallback) {
  const maybeNumber = Number(value);
  return Number.isFinite(maybeNumber) ? maybeNumber : fallback;
}

export async function gotoLandingPage(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("[data-landing-slot]", { timeout: 20_000 });
}

export async function collectLandingSlots(page) {
  const slots = await page.evaluate(() => {
    const sectionEls = Array.from(document.querySelectorAll("[data-landing-slot]"));

    return sectionEls
      .map((el, index) => {
        const rect = el.getBoundingClientRect();
        const titleEl = el.querySelector("h1, h2, h3");
        const slot = el.getAttribute("data-landing-slot") || `slot-${index + 1}`;
        const id = el.id || `landing-slot-${slot}`;

        return {
          index,
          slot,
          id,
          title: titleEl?.textContent?.trim() || slot,
          top: Math.round(rect.top + window.scrollY),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.height > 0)
      .sort((a, b) => a.top - b.top);
  });

  return slots;
}

export function labelForSlot(slot, index) {
  const slotName = slot.slot || `slot-${index + 1}`;
  return `${String(index + 1).padStart(2, "0")}-${slugify(slotName)}`;
}

export async function installCinematicHarness(page) {
  await page.addStyleTag({
    content: `
      #landing-cinema-cursor {
        position: fixed;
        left: 0;
        top: 0;
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 255, 255, 0.95);
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.1));
        box-shadow: 0 6px 26px rgba(0, 0, 0, 0.28);
        pointer-events: none;
        transform: translate3d(-9999px, -9999px, 0);
        z-index: 2147483640;
        transition: transform 40ms linear;
      }

      #landing-cinema-cursor::after {
        content: "";
        position: absolute;
        inset: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.28);
      }

      #landing-cinema-callout {
        position: fixed;
        left: -9999px;
        top: -9999px;
        z-index: 2147483641;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 280ms ease, transform 280ms ease;
        pointer-events: none;
        padding: 6px 11px;
        border-radius: 999px;
        color: #0f172a;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(14, 23, 41, 0.14);
        font: 600 12px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0.02em;
        white-space: nowrap;
        box-shadow: 0 16px 38px rgba(15, 23, 42, 0.18);
      }

      .landing-cinema-ripple {
        position: fixed;
        left: 0;
        top: 0;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.45);
        pointer-events: none;
        z-index: 2147483640;
        transform: translate3d(-50%, -50%, 0) scale(0.12);
        opacity: 0;
      }

      html.landing-cinema-soft-focus [data-landing-slot] {
        filter: blur(var(--landing-cinema-blur, 2px));
        opacity: 0.7;
        transition: filter 320ms ease, opacity 320ms ease;
      }

      html.landing-cinema-soft-focus [data-landing-slot].landing-cinema-focus {
        filter: blur(0) !important;
        opacity: 1 !important;
      }
    `,
  });

  await page.evaluate(() => {
    if (window.__landingCinema) {
      return;
    }

    const cursor = document.createElement("div");
    cursor.id = "landing-cinema-cursor";
    document.body.appendChild(cursor);

    const callout = document.createElement("div");
    callout.id = "landing-cinema-callout";
    document.body.appendChild(callout);

    window.__landingCinema = {
      cursor,
      callout,
      x: 84,
      y: 92,
      mountedAt: Date.now(),
      stage: document.querySelector("main") || document.body,
    };

    cursor.style.transform = `translate3d(${window.__landingCinema.x}px, ${window.__landingCinema.y}px, 0)`;
  });
}

export async function playCinematicShot(page, slotSelector, options = {}) {
  const {
    zoom = 1.12,
    blurPx = 2,
    callout = "Spotlight",
    scrollPaddingTop = 96,
    scrollDurationMs = 720,
    trackDurationMs = 780,
    preClickHoldMs = 360,
    settleMs = 420,
  } = options;

  await page.evaluate(
    async ({
      selector,
      zoomValue,
      blurValue,
      calloutText,
      paddingTop,
      scrollMs,
      trackMs,
      holdMs,
      settleDuration,
    }) => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

      const state = window.__landingCinema;
      if (!state) {
        return;
      }

      const slot = document.querySelector(selector);
      if (!slot) {
        return;
      }

      const slotRectBeforeScroll = slot.getBoundingClientRect();
      const targetScroll = Math.max(
        0,
        window.scrollY + slotRectBeforeScroll.top - paddingTop,
      );

      const scrollStart = window.scrollY;
      const scrollDelta = targetScroll - scrollStart;
      const scrollStartTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const elapsed = now - scrollStartTime;
          const progress = Math.min(1, elapsed / Math.max(1, scrollMs));
          const eased = ease(progress);

          window.scrollTo({ top: scrollStart + scrollDelta * eased, behavior: "auto" });

          if (progress < 1) {
            requestAnimationFrame(tick);
            return;
          }

          resolve();
        };

        requestAnimationFrame(tick);
      });

      await wait(110);

      const slotRect = slot.getBoundingClientRect();
      const targetX = slotRect.left + slotRect.width * 0.5;
      const targetY = Math.max(
        38,
        Math.min(
          window.innerHeight - 38,
          slotRect.top + Math.min(slotRect.height * 0.35, 210),
        ),
      );

      const startX = state.x;
      const startY = state.y;
      const jitterX = (Math.random() - 0.5) * 16;
      const jitterY = (Math.random() - 0.5) * 10;
      const endX = targetX + jitterX;
      const endY = targetY + jitterY;
      const trackStartTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const elapsed = now - trackStartTime;
          const progress = Math.min(1, elapsed / Math.max(1, trackMs));
          const eased = ease(progress);

          state.x = startX + (endX - startX) * eased;
          state.y = startY + (endY - startY) * eased;
          state.cursor.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;

          if (progress < 1) {
            requestAnimationFrame(tick);
            return;
          }

          resolve();
        };

        requestAnimationFrame(tick);
      });

      document.documentElement.style.setProperty("--landing-cinema-blur", `${blurValue}px`);
      document.documentElement.classList.add("landing-cinema-soft-focus");
      slot.classList.add("landing-cinema-focus");

      const stage = state.stage || document.body;
      const centerX = Math.round(slotRect.left + slotRect.width / 2);
      const centerY = Math.round(slotRect.top + Math.min(slotRect.height / 2, window.innerHeight * 0.55));

      stage.style.willChange = "transform";
      stage.style.transition = "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)";
      stage.style.transformOrigin = `${centerX}px ${centerY}px`;
      stage.style.transform = `scale(${zoomValue})`;

      if (calloutText) {
        state.callout.textContent = calloutText;
        state.callout.style.left = `${Math.max(10, Math.min(window.innerWidth - 220, targetX - 16))}px`;
        state.callout.style.top = `${Math.max(10, targetY - 52)}px`;
        state.callout.style.opacity = "1";
        state.callout.style.transform = "translateY(-4px)";
      }

      const pulseScale = Math.min(1.08, 1 + (zoomValue - 1) * 0.42);
      slot.animate(
        [
          { transform: "scale(1)", offset: 0 },
          { transform: `scale(${pulseScale})`, offset: 0.55 },
          { transform: "scale(1)", offset: 1 },
        ],
        {
          duration: holdMs + 240,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "none",
        },
      );

      await wait(holdMs);

      const ripple = document.createElement("div");
      ripple.className = "landing-cinema-ripple";
      ripple.style.left = `${targetX}px`;
      ripple.style.top = `${targetY}px`;
      document.body.appendChild(ripple);

      ripple.animate(
        [
          { transform: "translate3d(-50%, -50%, 0) scale(0.1)", opacity: 0.75 },
          { transform: "translate3d(-50%, -50%, 0) scale(1.95)", opacity: 0 },
        ],
        {
          duration: 460,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );

      await wait(260);
      ripple.remove();

      await wait(settleDuration);

      stage.style.transform = "scale(1)";

      state.callout.style.opacity = "0";
      state.callout.style.transform = "translateY(4px)";

      await wait(300);

      slot.classList.remove("landing-cinema-focus");
      document.documentElement.classList.remove("landing-cinema-soft-focus");
    },
    {
      selector: slotSelector,
      zoomValue: zoom,
      blurValue: blurPx,
      calloutText: callout,
      paddingTop: scrollPaddingTop,
      scrollMs: scrollDurationMs,
      trackMs: trackDurationMs,
      holdMs: preClickHoldMs,
      settleDuration: settleMs,
    },
  );
}

export async function moveToTop(page, holdMs = 250) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  if (holdMs > 0) {
    await page.waitForTimeout(holdMs);
  }
}

export async function saveRecordedVideo(context, page, destinationPath) {
  const video = page.video();
  await context.close();

  if (!video) {
    return null;
  }

  const sourcePath = await video.path();
  await ensureDir(path.dirname(destinationPath));

  try {
    await fs.rename(sourcePath, destinationPath);
  } catch {
    const bytes = await fs.readFile(sourcePath);
    await fs.writeFile(destinationPath, bytes);
    await fs.unlink(sourcePath);
  }

  return destinationPath;
}
