import { describe, expect, it } from "vitest"

import { getDashboardAnnouncementGradient } from "@/components/site/utility/gradients"

const blueAnnouncementGradients = new Set([
  "linear-gradient(to right, #dbeafe, #60a5fa, #1d4ed8)",
  "linear-gradient(to right, #38bdf8, #3b82f6)",
  "linear-gradient(to right, #9ca3af, #4b5563, #1e3a8a)",
  "linear-gradient(to right, #1d4ed8, #1e40af, #111827)",
  "linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6)",
])

describe("getDashboardAnnouncementGradient", () => {
  it("keeps the dashboard announcement card on a blue palette", () => {
    for (const seed of [-5, -1, 0, 1, 2, 3, 4, 5, 123]) {
      const gradient = getDashboardAnnouncementGradient(seed)

      expect(blueAnnouncementGradients.has(gradient.background)).toBe(true)
    }
  })
})
