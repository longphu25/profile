// Token list component — shows all balances for connected wallet

import { formatBalance, type TokenBalance } from './types'

interface TokenListProps {
  balances: TokenBalance[]
  loading: boolean
}

export function TokenList({ balances, loading }: TokenListProps) {
  if (loading) return <div className="swp__loading">Loading tokens...</div>
  if (balances.length === 0) return <div className="swp__empty">No tokens found</div>

  return (
    <div className="swp__tokens">
      <div className="swp__section-title">Tokens ({balances.length})</div>
      {balances.map((b) => (
        <div key={b.coinType} className="swp__token-row">
          <div className="swp__token-info">
            <span className="swp__token-symbol">{b.symbol}</span>
            <span className="swp__token-type">
              {b.coinType.split('::').slice(0, 2).join('::').slice(0, 20)}...
            </span>
          </div>
          <div className="swp__token-amount">{formatBalance(b.balance, b.decimals)}</div>
        </div>
      ))}
    </div>
  )
}
