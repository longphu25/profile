import type { FC } from 'react'
import type { RouteQuote, DexId } from '../lib/types'
import { RouteCard } from './RouteCard'

interface RouteListProps {
  quotes: RouteQuote[]
  toToken: string
  selectedRoute: DexId | null
  bestDex: DexId | null
  loading: boolean
  hasAmount: boolean
  onSelectRoute: (dex: DexId) => void
}

/** Route list container — SRP: orchestrates RouteCard rendering */
export const RouteList: FC<RouteListProps> = ({
  quotes,
  toToken,
  selectedRoute,
  bestDex,
  loading,
  hasAmount,
  onSelectRoute,
}) => {
  if (!hasAmount) return null

  return (
    <div className="sui-swap__routes">
      <div className="sui-swap__routes-label">
        Routes {loading && <span className="sui-swap__loading-dot">●</span>}
      </div>
      {quotes.map((quote) => (
        <RouteCard
          key={quote.dex}
          quote={quote}
          toToken={toToken}
          isSelected={selectedRoute === quote.dex}
          isBest={quote.dex === bestDex}
          onSelect={onSelectRoute}
        />
      ))}
      {!loading && quotes.length === 0 && (
        <div className="sui-swap__no-routes">No routes available for this pair</div>
      )}
    </div>
  )
}
