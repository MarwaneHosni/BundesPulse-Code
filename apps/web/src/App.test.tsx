import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { App } from "@/App"

function renderApp(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("App shell", () => {
  it("renders the homepage shell with the seven domains", () => {
    renderApp("/")
    expect(screen.getByRole("heading", { name: /Deutschland Digital Monitor/i })).toBeInTheDocument()
    expect(screen.getByText("Demography")).toBeInTheDocument()
    expect(screen.getByText("Infrastructure")).toBeInTheDocument()
  })

  it("navigates to the Explore view via the header", async () => {
    const user = userEvent.setup()
    renderApp("/")
    await user.click(screen.getByRole("link", { name: "Explore" }))
    expect(screen.getByRole("heading", { name: "Explore" })).toBeInTheDocument()
  })

  it("shows the not-found page for unknown routes", () => {
    renderApp("/nope")
    expect(screen.getByText("Seite nicht gefunden")).toBeInTheDocument()
  })
})