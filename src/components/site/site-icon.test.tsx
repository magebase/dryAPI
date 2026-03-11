import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SiteIcon } from "@/components/site/site-icon"

vi.mock("lucide-react", () => {
  const makeIcon = (name: string) => ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon">
      {name}
    </span>
  )

  return {
    Bolt: makeIcon("bolt"),
    Factory: makeIcon("factory"),
    HardHat: makeIcon("hard-hat"),
    Plug: makeIcon("plug"),
    Radio: makeIcon("radio"),
    Settings: makeIcon("settings"),
    Shield: makeIcon("shield"),
    Sun: makeIcon("sun"),
    Truck: makeIcon("truck"),
    Wrench: makeIcon("wrench"),
  }
})

describe("SiteIcon", () => {
  it("renders mapped icon when key exists", () => {
    const { getByTestId } = render(<SiteIcon className="size-4" icon="truck" />)
    expect(getByTestId("icon")).toHaveTextContent("truck")
  })

  it("falls back to wrench for unknown icons", () => {
    const { getByTestId } = render(<SiteIcon icon="unknown" />)
    expect(getByTestId("icon")).toHaveTextContent("wrench")
  })
})
