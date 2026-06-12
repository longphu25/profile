import type { FC } from 'react'
import type { RouteQuote, DexId } from '../lib/types'
import { formatNum } from '../lib/utils'

interface RouteCardProps {
  quote: RouteQuote
  toToken: string
  isSelected: boolean
  isBest: boolean
  onSelect: (dex: DexId) => void
}

/** Single route quote card — SRP: only renders one DEX quote */
export const RouteCard: FC<RouteCardProps> = ({ quote, toToken, isSelected, isBest, onSelect }) => {
  const impactClass =
    quote.priceImpact > 3
      ? 'sui-swap__route-impact--high'
      : quote.priceImpact > 1
        ? 'sui-swap__route-impact--med'
        : ''

  return (
    <button
      className={`sui-swap__route-card ${isSelected ? 'sui-swap__route-card--selected' : ''}`}
      onClick={() => onSelect(quote.dex)}
      style={{ borderColor: isSelected ? quote.fee.token : undefined }}
    >
      <div className="sui-swap__route-top">
        <span className="sui-swap__route-dex">
          {quote.dex === 'deepbook' && '📊'}
          {quote.dex === 'cetus' && '🐋'}
          {quote.dex === 'turbos' && '⚡'} {quote.dexLabel}
        </span>
        {isBest && <span className="sui-swap__route-badge">BEST</span>}
      </div>
      <div className="sui-swap__route-bottom">
        <span className="sui-swap__route-output">
          {formatNum(quote.outputAmount)} {toToken}
        </span>
        <span className={`sui-swap__route-impact ${impactClass}`}>
          {quote.priceImpact > 0.01 ? `${quote.priceImpact.toFixed(2)}% impact` : '<0.01%'}
        </span>
      </div>
    </button>
  )
}
