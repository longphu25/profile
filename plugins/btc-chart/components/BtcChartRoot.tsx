import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LIVE_REFRESH_MS } from '../lib/constants'
import { BtcChartPage } from './BtcChartPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: LIVE_REFRESH_MS,
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
