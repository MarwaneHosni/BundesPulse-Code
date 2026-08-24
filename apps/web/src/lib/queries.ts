import { useQuery } from "@tanstack/react-query"
import { fetchHealth, type HealthResponse } from "@/lib/api"

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: 1,
    refetchInterval: 30_000,
  })
}