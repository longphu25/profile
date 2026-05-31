/**
 * ActionHub — First-screen hero for DeepBook Predict.
 * Shows: BTC spot, oracle health, wallet state, 3 primary CTAs.
 * Plan 02: turn 13 tabs into 3 primary user actions.
 */

import type { FeatureStatus, UserIntent } from '../types'

const PRICE_SCALE = 1e9

interface Props {
  spot: number | null
  forward: number | null
  oracleExpiry: number | null
  oracleHealth: 'HEALTHY' | 'DELAYED' | 'STALE' | null
  isConnected: boolean
  dusdcBalance: string | null
  claimableCount: number
  onIntent: (intent: UserIntent) => void
  onConnect: () => void
}

function timeLeft(ms: number) {
  const d = ms - Date.now()
  if (d <= 0) return 'Expired'
  const m = Math.floor(d / 60000)
  return m < 60 ? `${m}m left` : `${Math.floor(m / 60)}h ${m % 60}m left`
}

function fmtPrice(raw: number | null) {
  if (!raw) return '—'
  return `$${(raw / PRICE_SCALE).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const healthColor: Record<string, string> = {
  HEALTHY: 'var(--color-mint)',
  DELAYED: 'var(--color-amber)',
  STALE: '#ff6b6b',
}

const statusLabel: Record<FeatureStatus, string> = {
  live: 'Live on Testnet',
  simulated: 'Simulated',
  experimental: 'Experimental',
  'requires-wallet': 'Requires Wallet',
}

export function ActionHub({
  spot,
  forward,
  oracleExpiry,
  oracleHealth,
  isConnected,
  dusdcBalance,
  claimableCount,
  onIntent,
  onConnect,
}: Props) {
  const isStale = oracleHealth === 'STALE'

  // Recommended next action
  let recommendation: string
  if (!isConnected) recommendation = 'Connect your wallet to start trading'
  else if (claimableCount > 0)
    recommendation = `You have ${claimableCount} settled position${claimableCount > 1 ? 's' : ''} ready to claim`
  else if (isStale) recommendation = 'Oracle feed is stale — check market health before trading'
  else recommendation = 'Active BTC oracle is healthy — ready to trade'

  return (
    <div className="action-hub">
      {/* Status strip */}
      <div className="action-hub__strip">
        <div className="action-hub__stat">
          <span className="action-hub__label">BTC Spot</span>
          <span className="action-hub__value action-hub__value--price">{fmtPrice(spot)}</span>
        </div>
        <div className="action-hub__stat">
          <span className="action-hub__label">Forward</span>
          <span className="action-hub__value">{fmtPrice(forward)}</span>
        </div>
        {oracleExpiry && (
          <div className="action-hub__stat">
            <span className="action-hub__label">Expiry</span>
            <span className="action-hub__value">{timeLeft(oracleExpiry)}</span>
          </div>
        )}
        {oracleHealth && (
          <div className="action-hub__stat">
            <span className="action-hub__label">Oracle</span>
            <span
              className="action-hub__value action-hub__value--badge"
              style={{ color: healthColor[oracleHealth] }}
            >
              {oracleHealth}
            </span>
          </div>
        )}
        {isConnected && dusdcBalance && (
          <div className="action-hub__stat">
            <span className="action-hub__label">DUSDC</span>
            <span className="action-hub__value">{dusdcBalance}</span>
          </div>
        )}
        <div className="action-hub__stat action-hub__stat--network">
          <span className="action-hub__badge action-hub__badge--testnet">Testnet</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className="action-hub__rec">
        <span className="action-hub__rec-icon">
          {claimableCount > 0 ? '●' : isStale ? '⚠' : '→'}
        </span>
        <span>{recommendation}</span>
      </div>

      {/* Primary CTAs */}
      <div className="action-hub__ctas">
        {!isConnected ? (
          <button type="button" className="action-hub__cta action-hub__cta--primary" onClick={onConnect}>
            Connect Wallet
          </button>
        ) : (
          <>
            <button type="button"
              className={`action-hub__cta action-hub__cta--primary ${isStale ? 'action-hub__cta--disabled' : ''}`}
              onClick={() => !isStale && onIntent('trade')}
              disabled={isStale}
              title={isStale ? 'Oracle is stale — trading paused' : undefined}
            >
              <span>Start Guided Trade</span>
              <span className="action-hub__cta-tag">{statusLabel['live']}</span>
            </button>
            <button type="button"
              className="action-hub__cta action-hub__cta--secondary"
              onClick={() => onIntent('analyze')}
            >
              <span>Analyze Market</span>
              <span className="action-hub__cta-tag">{statusLabel['live']}</span>
            </button>
            <button type="button"
              className="action-hub__cta action-hub__cta--secondary"
              onClick={() => onIntent('earn')}
            >
              <span>Earn with PLP</span>
              <span className="action-hub__cta-tag">{statusLabel['live']}</span>
            </button>
            {claimableCount > 0 && (
              <button type="button"
                className="action-hub__cta action-hub__cta--accent"
                onClick={() => onIntent('claim')}
              >
                <span>
                  Claim {claimableCount} Position{claimableCount > 1 ? 's' : ''}
                </span>
                <span className="action-hub__cta-tag">Ready</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
