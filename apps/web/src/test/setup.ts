import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// jsdom does not implement canvas, WebGL, or ResizeObserver. Charts (ECharts)
// and the map (MapLibre) require them, so we stub them — components still
// render and exercise their React logic; visuals are no-ops in tests.
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

vi.mock("maplibre-gl", () => {
  class Map {
    on = vi.fn(() => this)
    once = vi.fn(() => this)
    off = vi.fn(() => this)
    setStyle = vi.fn(() => this)
    resize = vi.fn()
    remove = vi.fn()
    addControl = vi.fn(() => this)
    fitBounds = vi.fn()
    isStyleLoaded = vi.fn(() => true)
    setPaintProperty = vi.fn(() => this)
    setFeatureState = vi.fn()
    removeFeatureState = vi.fn()
    getCanvas = vi.fn(() => ({ getBoundingClientRect: () => ({ width: 640, height: 480 }) }))
    getSource = vi.fn(() => ({ setData: vi.fn() }))
  }
  class NavigationControl {}
  class Popup {
    setLngLat = vi.fn(() => this)
    setHTML = vi.fn(() => this)
    setText = vi.fn(() => this)
    addTo = vi.fn(() => this)
    remove = vi.fn()
  }
  class AttributionControl {}
  return { Map, NavigationControl, Popup, AttributionControl }
})