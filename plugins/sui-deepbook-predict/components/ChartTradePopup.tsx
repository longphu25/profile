import { useState } from 'react'
import type { ChartTradeDraft } from '../domain/types'
import { computeFairValue, computeRangeFairValue } from '../domain/svi'
import { usdToStrikeRaw } from '../domain/strike'
import { STRIKE_SCALE } from '../domain/constants'

interface Props {
  draft: ChartTradeDraft | null
  oracleState: any
  isConnected: boolean
  onCancel: () => void
  onConfirm: (amount: string) => Promise<void>
}

function fmtStrike(raw: number) {
  return `$${(raw / STRIKE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function ChartTradePopup({ draft, oracleState, isConnected, onCancel, onConfirm }: Props) {
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!draft) return null

  const svi = oracleState?.latest_svi
  const forward = oracleState?.latest_price?.forward
  const expiry = oracleState?.oracle?.expiry

  let probability: number | null = null
  if (svi && forward && expiry) {
    try {
      if (draft.mode === 'binary') {
        probability = computeFairValue(svi, forward, expiry, usdToStrikeRaw(draft.strike), 0)
      } else {
        probability = computeRangeFairValue(
          svi,
          forward,
          expiry,
          usdToStrikeRaw(draft.lowerStrike),
          usdToStrikeRaw(draft.upperStrike),
        )
      }
    } catch {
      probability = null
    }
  }

  const maxWin = amount && probability ? (Number(amount) / probability).toFixed(2) : null
  const degraded = !svi || !forward

  const handleConfirm = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Enter a DUSDC amount.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(amount)
      setAmount('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  return (
    <div className="predict-popup__backdrop" onClick={onCancel}>
      <div className="predict-popup" onClick={(e) => e.stopPropagation()}>
        <div className="predict-popup__header">
          <span className="predict-popup__title">
            {draft.mode === 'binary' ? 'Binary Position' : 'Range Position'}
          </span>
          <button type="button" className="predict-popup__close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="predict-popup__body">
          {draft.mode === 'binary' ? (
            <div className="predict-popup__row">
              <span className="predict-popup__label">Strike</span>
              <span className={`predict-popup__val ${draft.isUp ? 'up' : 'dn'}`}>
                {fmtStrike(usdToStrikeRaw(draft.strike))} {draft.isUp ? '▲ UP' : '▼ DOWN'}
              </span>
            </div>
          ) : (
            <>
              <div className="predict-popup__row">
                <span className="predict-popup__label">Lower</span>
                <span className="predict-popup__val up">
                  {fmtStrike(usdToStrikeRaw(draft.lowerStrike))}
                </span>
              </div>
              <div className="predict-popup__row">
                <span className="predict-popup__label">Upper</span>
                <span className="predict-popup__val dn">
                  {fmtStrike(usdToStrikeRaw(draft.upperStrike))}
                </span>
              </div>
            </>
          )}
          <div className="predict-popup__row">
            <span className="predict-popup__label">Spot</span>
            <span className="predict-popup__val">
              ${draft.spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          {expiry && (
            <div className="predict-popup__row">
              <span className="predict-popup__label">Expiry</span>
              <span className="predict-popup__val">
                {new Date(expiry).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          <div className="predict-popup__divider" />

          {degraded && (
            <div className="predict-popup__warn">SVI unavailable — preview estimate not shown.</div>
          )}

          {probability != null && (
            <div className="predict-popup__row">
              <span className="predict-popup__label">Win probability</span>
              <span className="predict-popup__val">{(probability * 100).toFixed(1)}%</span>
            </div>
          )}

          <div className="predict-popup__field">
            <label className="predict-popup__label">DUSDC amount</label>
            <input
              className="predict-popup__input"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
            />
          </div>

          {maxWin && (
            <div className="predict-popup__row">
              <span className="predict-popup__label">Max win</span>
              <span className="predict-popup__val up">≈ {maxWin} DUSDC</span>
            </div>
          )}

          {!isConnected && <div className="predict-popup__warn">Connect wallet to confirm.</div>}

          {error && <div className="predict-popup__error">{error}</div>}
        </div>

        <div className="predict-popup__footer">
          <button
            type="button"
            className="predict-popup__btn predict-popup__btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="predict-popup__btn predict-popup__btn--primary"
            onClick={handleConfirm}
            disabled={submitting || !isConnected || !amount}
          >
            {submitting ? 'Minting…' : 'Confirm Mint'}
          </button>
        </div>
      </div>
    </div>
  )
}
