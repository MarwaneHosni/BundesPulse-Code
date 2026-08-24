import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// jsdom does not implement canvas or ResizeObserver. Charts (ECharts) require
// both, so we stub them in tests — components still render, charts just no-op.
vi.mock("echarts/core", () => ({
  init: () => ({
    setOption: () => {},
    resize: () => {},
    dispose: () => {},
    on: () => {},
  }),
  use: () => {},
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)