/**
 * GuidedTrade — 5-step wizard for first-time traders.
 * Steps: market → prediction → amount → preview → submit
 * Plan 02: user can create a trade in ≤5 actions after wallet connect.
 */

import { useState, useEffect } from 'react'
import {
  DUSDC_DECIMALS,
  DUSDC_TYPE,
  PREDICT_ID,
  PREDICT_PACKAGE,
  PRICE_SCALE,
  STRIKE_SCALE,
} from '../domain'
import { getManagersByOwner } from '../data/managerRepository'
import { getOracleState, getOracles } from '../data/predictRepository'
import type { GuidedTradeStep } from '../types'

interface Props {
  sharedHost: any
  walletAddress: string | null
  isConnected: boolean
  onClose: () => void
}

interface OracleOption {
  oracle_id: string
  underlying_asset: string
  expiry: number
  min_strike: number
  tick_size: number
  status: string
}

type Direction = 'up' | 'down' | 'range'

const STEPS: { id: GuidedTradeStep; label: string }[] = [
  { id: 'market', label: 'Market' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'amount', label: 'Amount' },
  { id: 'preview', label: 'Preview' },
  { id: 'submit', label: 'Submit' },
]

export function GuidedTrade({ sharedHost, walletAddress, isConnected, onClose }: Props) {
  const [step, setStep] = useState<GuidedTradeStep>('market')
  const [oracles, setOracles] = useState<OracleOption[]>([])
  const [selectedOracle, setSelectedOracle] = useState<OracleOption | null>(null)
  const [spot, setSpot] = useState<number>(0)
  const [direction, setDirection] = useState<Direction>('up')
  const [strike, setStrike] = useState<number>(0)
  const [amount, setAmount] = useState<string>('25')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ digest: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch active oracles
  useEffect(() => {
    getOracles(PREDICT_ID)
      .then((data) => {
        const active = data.filter((o) => o.status === 'active' && o.expiry > Date.now())
        setOracles(active)
        if (active.length > 0) {
          setSelectedOracle(active[0])
        }
      })
      .catch(() => {})
  }, [])

  // Fetch spot when oracle selected
  useEffect(() => {
    if (!selectedOracle) return
    getOracleState(selectedOracle.oracle_id)
      .then((data: any) => {
        const s = data?.latest_price?.spot || 0
        setSpot(s)
        setStrike(s) // default ATM
      })
      .catch(() => {})
  }, [selectedOracle])

  const stepIdx = STEPS.findIndex((s) => s.id === step)
  const canNext = (() => {
    if (step === 'market') return !!selectedOracle
    if (step === 'prediction') return strike > 0
    if (step === 'amount') return Number(amount) > 0
    return true
  })()

  const next = () => {
    const i = stepIdx + 1
    if (i < STEPS.length) setStep(STEPS[i].id)
  }
  const prev = () => {
    const i = stepIdx - 1
    if (i >= 0) setStep(STEPS[i].id)
  }

  const timeLeft = (ms: number) => {
    const d = ms - Date.now()
    if (d <= 0) return 'Expired'
    const m = Math.floor(d / 60000)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }

  const fmtPrice = (raw: number) =>
    `$${(raw / PRICE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  const fmtStrike = (raw: number) =>
    `$${(raw / STRIKE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const strikePresets = [
    { label: 'ATM', value: spot },
    { label: '+$500', value: spot + 500 * STRIKE_SCALE },
    { label: '+$1000', value: spot + 1000 * STRIKE_SCALE },
    { label: '-$500', value: spot - 500 * STRIKE_SCALE },
    { label: '-$1000', value: spot - 1000 * STRIKE_SCALE },
  ]

  const amountPresets = ['10', '25', '50', '100']

  const winCondition =
    direction === 'up'
      ? `BTC > ${fmtStrike(strike)} at expiry`
      : `BTC < ${fmtStrike(strike)} at expiry`

  // Submit trade
  const handleSubmit = async () => {
    if (!sharedHost || !walletAddress || !selectedOracle) return
    setSubmitting(true)
    setError(null)
    try {
      const { Transaction } = await import('@mysten/sui/transactions')
      const tx = new Transaction()
      tx.setSender(walletAddress)

      const qty = BigInt(Math.floor(Number(amount) * 10 ** DUSDC_DECIMALS))
      const strikeU64 = BigInt(Math.round(strike))
      const expiryU64 = BigInt(selectedOracle.expiry)

      // market_key::up or ::down
      const keyTarget =
        direction === 'up'
          ? `${PREDICT_PACKAGE}::market_key::up`
          : `${PREDICT_PACKAGE}::market_key::down`

      const [marketKey] = tx.moveCall({
        target: keyTarget,
        arguments: [
          tx.pure.id(selectedOracle.oracle_id),
          tx.pure.u64(expiryU64),
          tx.pure.u64(strikeU64),
        ],
      })

      // Fetch manager
      const mine = (await getManagersByOwner(walletAddress)).at(0)
      if (!mine) throw new Error('No manager found. Deposit DUSDC first.')

      // mint
      tx.moveCall({
        target: `${PREDICT_PACKAGE}::predict::mint`,
        typeArguments: [DUSDC_TYPE],
        arguments: [
          tx.object(PREDICT_ID),
          tx.object(mine.manager_id),
          tx.object(selectedOracle.oracle_id),
          marketKey,
          tx.pure.u64(qty),
          tx.object.clock(),
        ],
      })

      const res = await sharedHost.signAndExecuteTransaction(tx)
      setResult({ digest: res.digest })
      setStep('submit')
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="guided-trade">
      {/* Progress */}
      <div className="guided-trade__progress">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`guided-trade__step ${i <= stepIdx ? 'guided-trade__step--active' : ''} ${i === stepIdx ? 'guided-trade__step--current' : ''}`}
          >
            <span className="guided-trade__step-num">{i + 1}</span>
            <span className="guided-trade__step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Safety strip */}
      <div className="guided-trade__safety">
        {selectedOracle && <span>⏱ {timeLeft(selectedOracle.expiry)}</span>}
        {spot > 0 && <span>BTC {fmtPrice(spot)}</span>}
        <span style={{ color: 'var(--color-sui)' }}>Testnet · DUSDC</span>
      </div>

      {/* Step content */}
      <div className="guided-trade__content">
        {step === 'market' && (
          <div className="guided-trade__section">
            <h3 className="guided-trade__title">Choose Market</h3>
            <p className="guided-trade__desc">Select an active BTC oracle</p>
            <div className="guided-trade__options">
              {oracles.map((o) => (
                <button
                  type="button"
                  key={o.oracle_id}
                  className={`guided-trade__option ${selectedOracle?.oracle_id === o.oracle_id ? 'guided-trade__option--selected' : ''}`}
                  onClick={() => setSelectedOracle(o)}
                >
                  <span className="guided-trade__option-main">BTC · {timeLeft(o.expiry)}</span>
                  <span className="guided-trade__option-sub">{o.oracle_id.slice(0, 10)}…</span>
                </button>
              ))}
              {oracles.length === 0 && (
                <p className="guided-trade__empty">No active oracles available</p>
              )}
            </div>
          </div>
        )}

        {step === 'prediction' && (
          <div className="guided-trade__section">
            <h3 className="guided-trade__title">Choose Prediction</h3>
            <p className="guided-trade__desc">What do you think BTC will do?</p>
            <div className="guided-trade__directions">
              <button
                type="button"
                className={`guided-trade__dir ${direction === 'up' ? 'guided-trade__dir--up' : ''}`}
                onClick={() => setDirection('up')}
              >
                BTC Up ↑
              </button>
              <button
                type="button"
                className={`guided-trade__dir ${direction === 'down' ? 'guided-trade__dir--down' : ''}`}
                onClick={() => setDirection('down')}
              >
                BTC Down ↓
              </button>
            </div>
            <p className="guided-trade__sublabel">Strike Price</p>
            <div className="guided-trade__presets">
              {strikePresets.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  className={`guided-trade__preset ${strike === p.value ? 'guided-trade__preset--active' : ''}`}
                  onClick={() => setStrike(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="guided-trade__win">Wins if: {winCondition}</p>
          </div>
        )}

        {step === 'amount' && (
          <div className="guided-trade__section">
            <h3 className="guided-trade__title">Enter Amount</h3>
            <p className="guided-trade__desc">How much DUSDC to risk?</p>
            <div className="guided-trade__input-row">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="guided-trade__input"
                placeholder="0"
                min="1"
              />
              <span className="guided-trade__unit">DUSDC</span>
            </div>
            <div className="guided-trade__presets">
              {amountPresets.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={`guided-trade__preset ${amount === a ? 'guided-trade__preset--active' : ''}`}
                  onClick={() => setAmount(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="guided-trade__warn">Max loss: {amount} DUSDC</p>
          </div>
        )}

        {step === 'preview' && (
          <div className="guided-trade__section">
            <h3 className="guided-trade__title">Preview Trade</h3>
            <div className="guided-trade__summary">
              <div className="guided-trade__row">
                <span>Direction</span>
                <span>{direction.toUpperCase()}</span>
              </div>
              <div className="guided-trade__row">
                <span>Strike</span>
                <span>{fmtStrike(strike)}</span>
              </div>
              <div className="guided-trade__row">
                <span>Amount</span>
                <span>{amount} DUSDC</span>
              </div>
              <div className="guided-trade__row">
                <span>Expiry</span>
                <span>{selectedOracle ? timeLeft(selectedOracle.expiry) : '—'}</span>
              </div>
              <div className="guided-trade__row">
                <span>Win condition</span>
                <span>{winCondition}</span>
              </div>
              <div className="guided-trade__row">
                <span>Max loss</span>
                <span style={{ color: '#ff6b6b' }}>{amount} DUSDC</span>
              </div>
              <div className="guided-trade__row">
                <span>Max win</span>
                <span style={{ color: 'var(--color-mint)' }}>
                  {(Number(amount) * (PRICE_SCALE / strike - 1) || Number(amount)).toFixed(1)} DUSDC
                  (est.)
                </span>
              </div>
            </div>
            {error && <p className="guided-trade__error">{error}</p>}
          </div>
        )}

        {step === 'submit' && result && (
          <div className="guided-trade__section guided-trade__section--center">
            <div className="guided-trade__success-icon">✓</div>
            <h3 className="guided-trade__title">Position Minted!</h3>
            <p className="guided-trade__desc">TX: {result.digest.slice(0, 12)}…</p>
            <button
              type="button"
              className="guided-trade__btn guided-trade__btn--primary"
              onClick={onClose}
            >
              View Portfolio
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step !== 'submit' && (
        <div className="guided-trade__nav">
          {stepIdx > 0 && (
            <button
              type="button"
              className="guided-trade__btn guided-trade__btn--ghost"
              onClick={prev}
            >
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step === 'preview' ? (
            <button
              type="button"
              className="guided-trade__btn guided-trade__btn--primary"
              onClick={handleSubmit}
              disabled={submitting || !isConnected}
            >
              {submitting ? 'Signing…' : 'Mint Position'}
            </button>
          ) : (
            <button
              type="button"
              className="guided-trade__btn guided-trade__btn--primary"
              onClick={next}
              disabled={!canNext}
            >
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
