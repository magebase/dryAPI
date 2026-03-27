import { describe, expect, it } from "vitest"

import {
  findModelByRouteSlug,
  toModelDisplayName,
  toModelRouteSlug,
} from "@/lib/deapi-model-routes"

describe("deapi model routes", () => {
  it("formats route slugs with readable separators", () => {
    expect(toModelRouteSlug("WhisperLargeV3")).toBe("whisper-large-v3")
    expect(toModelRouteSlug("ZImageTurbo_INT8")).toBe("z-image-turbo-int8")
  })

  it("formats display names with preserved acronyms", () => {
    expect(toModelDisplayName("Nanonets_Ocr_S_F16")).toBe("Nanonets OCR S F16")
    expect(toModelDisplayName("FLUX.2 Klein 4B BF16")).toBe("FLUX 2 Klein 4B BF16")
  })

  it("resolves models by the readable route slug", () => {
    expect(findModelByRouteSlug(["WhisperLargeV3", "ZImageTurbo_INT8"], "whisper-large-v3")).toBe(
      "WhisperLargeV3",
    )
  })
})