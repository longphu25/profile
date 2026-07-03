import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BtcChartPage } from './BtcChartPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
})

/** Plugin-owned React Query root (separate chunk from host). */
export function BtcChartRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <BtcChartPage />
    </QueryClientProvider>
  )
}
