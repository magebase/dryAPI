import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("merges and resolves Tailwind conflicts", () => {
    expect(cn("p-2", "p-4", "text-sm")).toBe("p-4 text-sm")
  })

  it("ignores falsy values", () => {
    expect(cn("block", undefined, false && "hidden", "mt-2")).toBe("block mt-2")
  })
})
