/**
 * Portfolio Tab — Positions, PnL, Claim Settled, Fair Value Preview
 * Implements P1 + P2 + P3 from TODO.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { fetchJSON } from '../sdk'
import {
  PREDICT_PACKAGE,
  PREDICT_ID,
  DUSDC_TYPE,
  DUSDC_DECIMALS,
  PRICE_SCALE,
  STRIKE_SCALE,
} from '../types'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import { CollapsibleNotes } from './shared'

interface Props {
  oracleState: any
  oracles: any[]
  walletAddress: string | null
  isConnected: boolean
  sharedHost: SuiHostAPI | null
  managerId: string | null
  managerIds?: string[]
}

// ── Normal CDF approximation ────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.SQRT2
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

// ── Fair value from SVI ─────────────────────────────────────────────────────
function computeFairValue(
  svi: {
    a: number
    b: number
    rho: number
    rho_negative: boolean
    m: number
    m_negative: boolean
    sigma: number
  },
  forward: number,
  expiry: number,
  strike: number,
  direction: number, // 0=up, 1=down
): number {
  const a = svi.a / 1e6,
    b = svi.b / 1e6
  const rho = ((svi.rho_negative ? -1 : 1) * svi.rho) / 1e9
  const m_val = ((svi.m_negative ? -1 : 1) * svi.m) / 1e6
  const sigma = svi.sigma / 1e6
  const F = forward / PRICE_SCALE
  const K = strike / STRIKE_SCALE
  if (K <= 0 || F <= 0) return 0
  const T = Math.max((expiry - Date.now()) / (365.25 * 24 * 3600 * 1000), 1 / 365)

  const k = Math.log(K / F)
  const diff = k - m_val
  const w = a + b * (rho * diff + Math.sqrt(diff * diff + sigma * sigma))
  if (w <= 0) return 0

  const sqrtW = Math.sqrt(w / T)
  const d2 = -k / sqrtW - sqrtW / 2
  const pUp = normalCDF(d2)
  return direction === 0 ? pUp : 1 - pUp
}

function computeRangeFairValue(
  svi: any,
  forward: number,
  expiry: number,
  lower: number,
  higher: number,
): number {
  if (lower <= 0 || higher <= 0 || lower >= higher) return 0
  const pLower = computeFairValue(svi, forward, expiry, lower, 0)
  const pHigher = computeFairValue(svi, forward, expiry, higher, 0)
  const result = pLower - pHigher
  return Number.isFinite(result) ? result : 0
}

export function PortfolioTab({
  oracleState,
  oracles,
  walletAddress,
  isConnected,
  sharedHost,
  managerId,
  managerIds = [],
}: Props) {
  const [positions, setPositions] = useState<any[]>([])
  const [ranges, setRanges] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pnlHistory, setPnlHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimResult, setClaimResult] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const allManagerIds = managerIds.length > 0 ? managerIds : managerId ? [managerId] : []

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(addr)
    setTimeout(() => setCopied(null), 1500)
  }

  const fetchPortfolio = useCallback(async () => {
    if (allManagerIds.length === 0) return
    setLoading(true)

    // Fetch from all managers in parallel
    const results = await Promise.all(
      allManagerIds.map(async (mid) => {
        const [summ, pos, minted, redeemed, pnl] = await Promise.all([
          fetchJSON<any>(`/managers/${mid}/summary`),
          fetchJSON<any[]>(`/managers/${mid}/positions/summary`),
          fetchJSON<any[]>(`/ranges/minted?manager_id=${mid}`),
          fetchJSON<any[]>(`/ranges/redeemed?manager_id=${mid}`),
          fetchJSON<any>(`/managers/${mid}/pnl?range=ALL`),
        ])
        return { summ, pos, minted, redeemed, pnl }
      }),
    )

    // Merge results from all managers
    let allPositions: any[] = []
    let allMinted: any[] = []
    let allRedeemed: any[] = []
    let mergedSummary: any = null
    let allPnlPoints: any[] = []

    for (const r of results) {
      if (r.summ && !mergedSummary) mergedSummary = r.summ
      else if (r.summ && mergedSummary) {
        mergedSummary.account_value =
          (mergedSummary.account_value || 0) + (r.summ.account_value || 0)
        mergedSummary.trading_balance =
          (mergedSummary.trading_balance || 0) + (r.summ.trading_balance || 0)
        mergedSummary.unrealized_pnl =
          (mergedSummary.unrealized_pnl || 0) + (r.summ.unrealized_pnl || 0)
        mergedSummary.realized_pnl = (mergedSummary.realized_pnl || 0) + (r.summ.realized_pnl || 0)
        mergedSummary.open_positions =
          (mergedSummary.open_positions || 0) + (r.summ.open_positions || 0)
      }
      if (r.pos && Array.isArray(r.pos)) allPositions = allPositions.concat(r.pos)
      if (r.minted) allMinted = allMinted.concat(r.minted)
      if (r.redeemed) allRedeemed = allRedeemed.concat(r.redeemed)
      if (r.pnl?.points) allPnlPoints = allPnlPoints.concat(r.pnl.points)
    }

    if (mergedSummary) setSummary(mergedSummary)
    setPositions(allPositions.filter((p: any) => Number(p.open_quantity) > 0))

    // Compute net open ranges from events
    const net = new Map<string, { row: any; qty: number }>()
    for (const m of allMinted) {
      const k = `${m.manager_id}|${m.oracle_id}|${m.expiry}|${m.lower_strike}|${m.higher_strike}`
      const cur = net.get(k)
      if (cur) cur.qty += Number(m.quantity)
      else net.set(k, { row: m, qty: Number(m.quantity) })
    }
    for (const r of allRedeemed) {
      const k = `${r.manager_id}|${r.oracle_id}|${r.expiry}|${r.lower_strike}|${r.higher_strike}`
      const cur = net.get(k)
      if (cur) cur.qty -= Number(r.quantity)
    }
    setRanges(
      [...net.values()].filter((r) => r.qty > 0).map((r) => ({ ...r.row, open_quantity: r.qty })),
    )
    if (allPnlPoints.length) setPnlHistory(allPnlPoints)
    setLoading(false)
  }, [managerIds, managerId])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  // Settled oracles with user positions
  const settledOracles = useMemo(() => oracles.filter((o) => o.status === 'settled'), [oracles])

  const spot = oracleState?.latest_price?.spot || 0
  const svi = oracleState?.latest_svi
  const forward = oracleState?.latest_price?.forward || 0

  // Claim settled position
  const handleClaim = async (position: any) => {
    if (!sharedHost || !walletAddress || !managerId) return
    setClaimingId(JSON.stringify(position.market_key || position.range_key))
    setClaimError(null)
    setClaimResult(null)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)

      if (position.market_key) {
        const mk = position.market_key
        const keyFn = mk.is_up ? 'up' : 'down'
        const [marketKey] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
          arguments: [tx.pure.id(mk.oracle_id), tx.pure.u64(mk.expiry), tx.pure.u64(mk.strike)],
        })
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::redeem`,
          typeArguments: [DUSDC_TYPE],
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(managerId),
            tx.object(mk.oracle_id),
            marketKey,
            tx.pure.u64(position.quantity),
            tx.object.clock(),
          ],
        })
      } else if (position.range_key) {
        const rk = position.range_key
        const [rangeKey] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::range_key::new`,
          arguments: [
            tx.pure.id(rk.oracle_id),
            tx.pure.u64(rk.expiry),
            tx.pure.u64(rk.lower_strike),
            tx.pure.u64(rk.higher_strike),
          ],
        })
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::redeem_range`,
          typeArguments: [DUSDC_TYPE],
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(managerId),
            tx.object(rk.oracle_id),
            rangeKey,
            tx.pure.u64(position.quantity),
            tx.object.clock(),
          ],
        })
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setClaimResult(result.digest)
      sharedHost.setSharedData('txRefresh', Date.now())
      fetchPortfolio()
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : String(e))
    }
    setClaimingId(null)
  }

  // Batch claim all settled
  const handleClaimAll = async () => {
    if (!sharedHost || !walletAddress || !managerId || !positions) return
    const settled = getSettledPositions()
    if (settled.length === 0) return

    setClaimingId('all')
    setClaimError(null)
    setClaimResult(null)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)

      for (const pos of settled) {
        if (pos.market_key) {
          const mk = pos.market_key
          const keyFn = mk.is_up ? 'up' : 'down'
          const [marketKey] = tx.moveCall({
            target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
            arguments: [tx.pure.id(mk.oracle_id), tx.pure.u64(mk.expiry), tx.pure.u64(mk.strike)],
          })
          tx.moveCall({
            target: `${PREDICT_PACKAGE}::predict::redeem`,
            typeArguments: [DUSDC_TYPE],
            arguments: [
              tx.object(PREDICT_ID),
              tx.object(managerId),
              tx.object(mk.oracle_id),
              marketKey,
              tx.pure.u64(pos.quantity),
              tx.object.clock(),
            ],
          })
        } else if (pos.range_key) {
          const rk = pos.range_key
          const [rangeKey] = tx.moveCall({
            target: `${PREDICT_PACKAGE}::range_key::new`,
            arguments: [
              tx.pure.id(rk.oracle_id),
              tx.pure.u64(rk.expiry),
              tx.pure.u64(rk.lower_strike),
              tx.pure.u64(rk.higher_strike),
            ],
          })
          tx.moveCall({
            target: `${PREDICT_PACKAGE}::predict::redeem_range`,
            typeArguments: [DUSDC_TYPE],
            arguments: [
              tx.object(PREDICT_ID),
              tx.object(managerId),
              tx.object(rk.oracle_id),
              rangeKey,
              tx.pure.u64(pos.quantity),
              tx.object.clock(),
            ],
          })
        }
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setClaimResult(result.digest)
      sharedHost.setSharedData('txRefresh', Date.now())
      fetchPortfolio()
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : String(e))
    }
    setClaimingId(null)
  }

  // Helper: get positions on settled oracles
  const getSettledPositions = (): any[] => {
    const settledIds = new Set(settledOracles.map((o) => o.oracle_id))
    const binarySettled = positions
      .filter((p: any) => settledIds.has(p.oracle_id))
      .map((p: any) => ({
        ...p,
        market_key: { oracle_id: p.oracle_id, expiry: p.expiry, strike: p.strike, is_up: p.is_up },
        quantity: p.open_quantity,
      }))
    const rangeSettled = ranges
      .filter((r: any) => settledIds.has(r.oracle_id))
      .map((r: any) => ({
        ...r,
        range_key: {
          oracle_id: r.oracle_id,
          expiry: r.expiry,
          lower_strike: r.lower_strike,
          higher_strike: r.higher_strike,
        },
        quantity: r.open_quantity,
      }))
    return [...binarySettled, ...rangeSettled]
  }

  const settledPositions = getSettledPositions()

  if (!isConnected) {
    return (
      <div className="sui-predict__grid">
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__empty">
            <p>Connect wallet to view portfolio</p>
            <button type="button" className="sui-predict__btn" onClick={() => sharedHost?.requestConnect()}>
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!managerId) {
    return (
      <div className="sui-predict__grid">
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__empty">
            <p>No PredictManager found. Mint a position first to create one.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sui-predict__grid">
      {/* Account Summary */}
      {summary && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Account Summary</h3>
            {allManagerIds.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                {allManagerIds.length} manager{allManagerIds.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Manager addresses */}
          {allManagerIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '10px',
                padding: '0 2px',
              }}
            >
              {allManagerIds.map((mid) => (
                <button type="button"
                  key={mid}
                  onClick={() => copyAddr(mid)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-ui-mono)',
                    color: copied === mid ? 'var(--color-mint)' : 'var(--color-muted)',
                    background: 'rgba(190,255,234,0.04)',
                    border: '1px solid var(--color-line)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                  title={mid}
                >
                  {mid.slice(0, 8)}…{mid.slice(-6)} {copied === mid ? '✓' : '⧉'}
                </button>
              ))}
            </div>
          )}
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Account Value</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                ${(Number(summary.account_value || 0) / 1e6).toFixed(2)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Trading Balance</span>
              <span className="sui-predict__stat-value">
                ${(Number(summary.trading_balance || 0) / 1e6).toFixed(2)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Realized PnL</span>
              <span
                className={`sui-predict__stat-value ${Number(summary.realized_pnl || 0) >= 0 ? 'sui-predict__stat-value--green' : 'sui-predict__stat-value--red'}`}
              >
                ${(Number(summary.realized_pnl || 0) / 1e6).toFixed(2)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Unrealized PnL</span>
              <span
                className={`sui-predict__stat-value ${Number(summary.unrealized_pnl || 0) >= 0 ? 'sui-predict__stat-value--green' : 'sui-predict__stat-value--red'}`}
              >
                ${(Number(summary.unrealized_pnl || 0) / 1e6).toFixed(2)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Open Positions</span>
              <span className="sui-predict__stat-value">{summary.open_positions || 0}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Awaiting Settlement</span>
              <span className="sui-predict__stat-value">
                {summary.awaiting_settlement_positions || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Claim Settled — TOP priority action */}
      {settledPositions.length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">
              Claimable Positions ({settledPositions.length})
            </h3>
            <button type="button"
              className="sui-predict__btn sui-predict__btn--sm"
              onClick={handleClaimAll}
              disabled={claimingId === 'all'}
            >
              {claimingId === 'all' ? 'Claiming…' : 'Claim All (1 PTB)'}
            </button>
          </div>
          <div className="sui-predict__table">
            <div className="sui-predict__table-header sui-predict__table-header--4col">
              <span>Type</span>
              <span>Strike</span>
              <span>Qty</span>
              <span>Action</span>
            </div>
            {settledPositions.map((p, i) => {
              const key = JSON.stringify(p.market_key || p.range_key)
              const isBinary = !!p.market_key
              const strike = isBinary
                ? `$${(p.market_key.strike / STRIKE_SCALE).toFixed(0)} ${p.market_key.direction === 0 ? 'UP' : 'DOWN'}`
                : `$${(p.range_key.lower_strike / STRIKE_SCALE).toFixed(0)}–$${(p.range_key.higher_strike / STRIKE_SCALE).toFixed(0)}`
              return (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>{isBinary ? 'Binary' : 'Range'}</span>
                  <span>{strike}</span>
                  <span>{(p.quantity / 10 ** DUSDC_DECIMALS).toFixed(2)}</span>
                  <span>
                    <button type="button"
                      className="sui-predict__btn sui-predict__btn--sm"
                      onClick={() => handleClaim(p)}
                      disabled={claimingId === key}
                    >
                      Claim
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
          {claimResult && (
            <div className="sui-predict__success">TX: {claimResult.slice(0, 16)}…</div>
          )}
          {claimError && <div className="sui-predict__error">{claimError}</div>}
        </div>
      )}

      {/* Fair Value Preview */}
      {svi && forward && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Fair Value Preview</h3>
            <span className="sui-predict__stat-value--mono">
              Spot: ${(spot / PRICE_SCALE).toFixed(0)}
            </span>
          </div>
          <FairValueCalculator
            svi={svi}
            forward={forward}
            expiry={oracleState?.oracle?.expiry || 0}
          />
        </div>
      )}

      {/* Open Positions */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Open Positions</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {spot > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-mint)',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                BTC ${(spot / PRICE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
            <button type="button"
              className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
              onClick={fetchPortfolio}
              disabled={loading}
            >
              {loading ? '⟳' : '↻'}
            </button>
          </div>
        </div>
        {!positions || (positions.length === 0 && ranges.length === 0) ? (
          <div className="sui-predict__empty">No open positions</div>
        ) : (
          <>
            {/* Group by manager */}
            {allManagerIds.map((mid) => {
              const mgrPositions = positions.filter((p: any) => p.manager_id === mid)
              const mgrRanges = ranges.filter((r: any) => r.manager_id === mid)
              if (mgrPositions.length === 0 && mgrRanges.length === 0) return null
              return (
                <div key={mid} style={{ marginBottom: '12px' }}>
                  {allManagerIds.length > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px',
                        padding: '0 4px',
                      }}
                    >
                      <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                        Manager:
                      </span>
                      <button type="button"
                        onClick={() => copyAddr(mid)}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-ui-mono)',
                          color: copied === mid ? 'var(--color-mint)' : 'var(--color-text)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title="Click to copy"
                      >
                        {mid.slice(0, 8)}…{mid.slice(-6)} {copied === mid ? '✓' : '⧉'}
                      </button>
                    </div>
                  )}
                  <div className="sui-predict__table">
                    <div className="sui-predict__table-header sui-predict__table-header--6col">
                      <span>Type</span>
                      <span>Oracle</span>
                      <span>Strike</span>
                      <span>Qty</span>
                      <span>Entry/Mark</span>
                      <span>uPnL</span>
                    </div>
                    {mgrPositions.map((p: any, i: number) => {
                      const qty = Number(p.open_quantity) / 10 ** DUSDC_DECIMALS
                      const entry = p.average_entry_price
                        ? (Number(p.average_entry_price) / PRICE_SCALE).toFixed(4)
                        : '—'
                      const mark = p.mark_price
                        ? (Number(p.mark_price) / PRICE_SCALE).toFixed(4)
                        : '—'
                      const upnl = p.unrealized_pnl
                        ? Number(p.unrealized_pnl) / 10 ** DUSDC_DECIMALS
                        : 0
                      const strikeLabel = `$${(Number(p.strike) / STRIKE_SCALE).toFixed(0)} ${p.is_up ? '▲' : '▼'}`
                      return (
                        <div
                          key={`b${i}`}
                          className="sui-predict__table-row sui-predict__table-row--6col"
                        >
                          <span>Binary</span>
                          <span>
                            <button type="button"
                              onClick={() => copyAddr(p.oracle_id)}
                              style={{
                                fontSize: '9px',
                                fontFamily: 'var(--font-ui-mono)',
                                color:
                                  copied === p.oracle_id
                                    ? 'var(--color-mint)'
                                    : 'var(--color-muted)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              title={p.oracle_id}
                            >
                              {p.oracle_id?.slice(0, 6)}…{p.oracle_id?.slice(-4)}{' '}
                              {copied === p.oracle_id ? '✓' : '⧉'}
                            </button>
                          </span>
                          <span>{strikeLabel}</span>
                          <span>${qty.toFixed(0)}</span>
                          <span>
                            {entry}/{mark}
                          </span>
                          <span
                            className={
                              upnl >= 0 ? 'sui-predict__text--green' : 'sui-predict__text--red'
                            }
                          >
                            {upnl !== 0 ? `${upnl >= 0 ? '+' : ''}$${upnl.toFixed(2)}` : '—'}
                          </span>
                        </div>
                      )
                    })}
                    {mgrRanges.map((r: any, i: number) => {
                      const qty = Number(r.open_quantity) / 10 ** DUSDC_DECIMALS
                      const strikeLabel = `$${(Number(r.lower_strike) / STRIKE_SCALE).toFixed(0)}–$${(Number(r.higher_strike) / STRIKE_SCALE).toFixed(0)}`
                      return (
                        <div
                          key={`r${i}`}
                          className="sui-predict__table-row sui-predict__table-row--6col"
                        >
                          <span>Range</span>
                          <span>
                            <button type="button"
                              onClick={() => copyAddr(r.oracle_id)}
                              style={{
                                fontSize: '9px',
                                fontFamily: 'var(--font-ui-mono)',
                                color:
                                  copied === r.oracle_id
                                    ? 'var(--color-mint)'
                                    : 'var(--color-muted)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              title={r.oracle_id}
                            >
                              {r.oracle_id?.slice(0, 6)}…{r.oracle_id?.slice(-4)}{' '}
                              {copied === r.oracle_id ? '✓' : '⧉'}
                            </button>
                          </span>
                          <span>{strikeLabel}</span>
                          <span>${qty.toFixed(0)}</span>
                          <span>—</span>
                          <span>—</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {/* Positions without manager_id match (fallback) */}
            {(() => {
              const ungrouped = positions.filter((p: any) => !allManagerIds.includes(p.manager_id))
              const ungroupedRanges = ranges.filter(
                (r: any) => !allManagerIds.includes(r.manager_id),
              )
              if (ungrouped.length === 0 && ungroupedRanges.length === 0) return null
              return (
                <div className="sui-predict__table">
                  <div className="sui-predict__table-header sui-predict__table-header--6col">
                    <span>Type</span>
                    <span>Strike</span>
                    <span>Qty</span>
                    <span>Entry</span>
                    <span>Mark</span>
                    <span>uPnL</span>
                  </div>
                  {ungrouped.map((p: any, i: number) => {
                    const qty = Number(p.open_quantity) / 10 ** DUSDC_DECIMALS
                    const entry = p.average_entry_price
                      ? (Number(p.average_entry_price) / PRICE_SCALE).toFixed(4)
                      : '—'
                    const mark = p.mark_price
                      ? (Number(p.mark_price) / PRICE_SCALE).toFixed(4)
                      : '—'
                    const upnl = p.unrealized_pnl
                      ? Number(p.unrealized_pnl) / 10 ** DUSDC_DECIMALS
                      : 0
                    const strikeLabel = `$${(Number(p.strike) / STRIKE_SCALE).toFixed(0)} ${p.is_up ? '▲' : '▼'}`
                    return (
                      <div
                        key={`ub${i}`}
                        className="sui-predict__table-row sui-predict__table-row--6col"
                      >
                        <span>Binary</span>
                        <span>{strikeLabel}</span>
                        <span>${qty.toFixed(0)}</span>
                        <span>{entry}</span>
                        <span>{mark}</span>
                        <span
                          className={
                            upnl >= 0 ? 'sui-predict__text--green' : 'sui-predict__text--red'
                          }
                        >
                          {upnl !== 0 ? `${upnl >= 0 ? '+' : ''}$${upnl.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* PnL History */}
      {pnlHistory.length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">PnL History</h3>
          </div>
          <div className="sui-predict__price-chart">
            <div className="sui-predict__bars">
              {pnlHistory.slice(-30).map((p, i, arr) => {
                const vals = arr.map((x) => x.pnl || 0)
                const max = Math.max(...vals.map(Math.abs)) || 1
                const pct = (Math.abs(p.pnl || 0) / max) * 100
                return (
                  <div key={i} className="sui-predict__bar-col">
                    <div
                      className={`sui-predict__bar ${(p.pnl || 0) >= 0 ? 'sui-predict__bar--green' : 'sui-predict__bar--red'}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={`$${(p.pnl || 0).toFixed(2)}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <CollapsibleNotes title="Portfolio Info">
        <h4>Positions</h4>
        <p>Shows all open binary and range positions from your PredictManager.</p>
        <h4>Fair Value</h4>
        <p>
          Estimated probability from the SVI surface. Does not include protocol spread or
          utilization adjustment.
        </p>
        <p className="sui-predict__formula">P(UP) = N(d₂) where d₂ = −k/√w − √w/2</p>
        <h4>Claim</h4>
        <p>
          After oracle settlement, redeem positions for payout. "Claim All" batches into one PTB.
        </p>
      </CollapsibleNotes>
    </div>
  )
}

// ── Fair Value Calculator ────────────────────────────────────────────────────

function FairValueCalculator({
  svi,
  forward,
  expiry,
}: {
  svi: any
  forward: number
  expiry: number
}) {
  const [strike, setStrike] = useState('')
  const [direction, setDirection] = useState<0 | 1>(0)

  const spotUsd = (forward / PRICE_SCALE).toFixed(0)
  const strikeNum = Number(strike) || 0

  const fairValue = useMemo(() => {
    if (!strikeNum || !svi || !forward) return null
    const strikeRaw = strikeNum * STRIKE_SCALE
    return computeFairValue(svi, forward, expiry, strikeRaw, direction)
  }, [strikeNum, svi, forward, expiry, direction])

  const rangeFV = useMemo(() => {
    if (!strikeNum || !svi || !forward) return null
    const lower = (strikeNum - 1000) * STRIKE_SCALE
    const upper = (strikeNum + 1000) * STRIKE_SCALE
    return computeRangeFairValue(svi, forward, expiry, lower, upper)
  }, [strikeNum, svi, forward, expiry])

  return (
    <div
      className="sui-predict__form"
      style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}
    >
      <div className="sui-predict__field">
        <label className="sui-predict__field-label">Strike (USD) — Forward: ${spotUsd}</label>
        <input
          className="sui-predict__input"
          type="number"
          placeholder={spotUsd}
          value={strike}
          onChange={(e) => setStrike(e.target.value)}
        />
      </div>
      <div className="sui-predict__toggle" style={{ marginBottom: '0' }}>
        <button type="button"
          className={`sui-predict__toggle-btn ${direction === 0 ? 'sui-predict__toggle-btn--green' : ''}`}
          onClick={() => setDirection(0)}
        >
          UP
        </button>
        <button type="button"
          className={`sui-predict__toggle-btn ${direction === 1 ? 'sui-predict__toggle-btn--red' : ''}`}
          onClick={() => setDirection(1)}
        >
          DOWN
        </button>
      </div>
      {fairValue !== null && (
        <div className="sui-predict__stats" style={{ gridColumn: '1 / -1' }}>
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">
              Binary {direction === 0 ? 'UP' : 'DOWN'}
            </span>
            <span className="sui-predict__stat-value sui-predict__stat-value--green">
              {(fairValue * 100).toFixed(2)}%
            </span>
          </div>
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">Cost per 100 DUSDC</span>
            <span className="sui-predict__stat-value">{(fairValue * 100).toFixed(2)} DUSDC</span>
          </div>
          {rangeFV !== null && (
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Range ±$1000</span>
              <span className="sui-predict__stat-value">{(rangeFV * 100).toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
