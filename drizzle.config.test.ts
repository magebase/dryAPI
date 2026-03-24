import { describe, expect, it, vi } from "vitest"

const { loadEnvMock, defineConfigMock } = vi.hoisted(() => ({
  loadEnvMock: vi.fn(),
  defineConfigMock: vi.fn((config: unknown) => config),
}))

vi.mock("dotenv", () => ({
  config: (...args: unknown[]) => loadEnvMock(...args),
}))

vi.mock("drizzle-kit", () => ({
  defineConfig: (...args: unknown[]) => defineConfigMock(...args),
}))

describe("drizzle.config", () => {
  it("loads only .env.local", async () => {
    await import("./drizzle.config")

    expect(loadEnvMock).toHaveBeenCalledTimes(1)
    expect(loadEnvMock).toHaveBeenCalledWith({
      path: ".env.local",
      override: true,
    })
  })
})