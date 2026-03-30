import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

import { SiteHeader } from "./site-header"
import type { SiteConfig } from "@/lib/site-content-schema"

const getClientAuthSessionSnapshotMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/client-auth-session", () => ({
  getClientAuthSessionSnapshot: () => getClientAuthSessionSnapshotMock(),
}))

vi.mock("@/components/site/brand-logo", () => ({
  BrandLogo: ({ name }: { name: string }) => <span>{name}</span>,
}))

vi.mock("@/components/site/quote-aware-link", () => ({
  QuoteAwareLink: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("tinacms/dist/react", () => ({
  tinaField: (_obj: unknown, field: string) => field,
}))

const mockSite = {
  announcement: "Trusted AI Infrastructure",
  brand: { mark: "dryAPI", name: "dryAPI" },
  header: {
    primaryLinks: [{ label: "Playground", href: "/playground" }],
    phone: { label: "Support", href: "/contact-sales" },
    quoteCta: { label: "Get Started", href: "/register", style: "outline" },
  },
} as unknown as SiteConfig

describe("SiteHeader", () => {
  beforeEach(() => {
    getClientAuthSessionSnapshotMock.mockReset()
  })

  it("shows Dashboard when the user is signed in", async () => {
    getClientAuthSessionSnapshotMock.mockResolvedValue({
      user: { id: "user_1" },
      session: { id: "session_1" },
    })

    render(<SiteHeader pathname="/" site={mockSite} />)

    await waitFor(() => {
      expect(
        screen.getAllByRole("link", { name: "Dashboard" }).some((link) =>
          link.getAttribute("href") === "/dashboard",
        ),
      ).toBe(true)
    })
  })

  it("keeps the marketing CTA for signed out users", async () => {
    getClientAuthSessionSnapshotMock.mockResolvedValue({
      user: null,
      session: null,
    })

    render(<SiteHeader pathname="/" site={mockSite} />)

    await waitFor(() => {
      expect(
        screen.getAllByRole("link", { name: "Get Started" }).some((link) =>
          link.getAttribute("href") === "/register",
        ),
      ).toBe(true)
    })
  })
})