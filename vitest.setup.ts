import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Mock server-only globally for tests to prevent import errors in Vitest
vi.mock("server-only", () => ({}))

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock

