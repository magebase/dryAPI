import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  createMDXMock,
  initOpenNextCloudflareForDevMock,
  withSerwistInitMock,
} = vi.hoisted(() => ({
  createMDXMock: vi.fn(() => (config: unknown) => config),
  initOpenNextCloudflareForDevMock: vi.fn(),
  withSerwistInitMock: vi.fn(() => (config: unknown) => config),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: (...args: unknown[]) =>
    initOpenNextCloudflareForDevMock(...args),
}))

vi.mock("fumadocs-mdx/next", () => ({
  createMDX: (...args: unknown[]) => createMDXMock(...args),
}))

vi.mock("@serwist/next", () => ({
  default: (...args: unknown[]) => withSerwistInitMock(...args),
}))

beforeEach(() => {
  vi.resetModules()
  createMDXMock.mockReset()
  initOpenNextCloudflareForDevMock.mockReset()
  withSerwistInitMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("root next config OpenNext dev bootstrap", () => {
  it("skips the dev bootstrap during production builds", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await import("../next.config")

    expect(initOpenNextCloudflareForDevMock).not.toHaveBeenCalled()
  })

  it("initializes the dev bootstrap in development", async () => {
    vi.stubEnv("NODE_ENV", "development")

    await import("../next.config")

    expect(initOpenNextCloudflareForDevMock).toHaveBeenCalledTimes(1)
    expect(initOpenNextCloudflareForDevMock).toHaveBeenCalledWith({
      configPath: "wrangler.local.jsonc",
    })
  })
})