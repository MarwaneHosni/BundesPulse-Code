import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/app-layout"
import { HomePage } from "@/pages/home"
import { ComparePage } from "@/pages/compare"
import { ExplorerPage } from "@/pages/explorer"
import { ExplorePage } from "@/pages/explore"
import { MethodologyPage } from "@/pages/methodology"
import { NotFoundPage } from "@/pages/not-found"
import { RankingsPage } from "@/pages/rankings"
import { RegionPage } from "@/pages/region"
import { RelationshipsPage } from "@/pages/relationships"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/region/:regionId" element={<RegionPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/explorer" element={<ExplorerPage />} />
          <Route path="/relationships" element={<RelationshipsPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  )
}