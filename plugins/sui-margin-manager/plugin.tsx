// SUI Margin Manager Plugin
// Inspect DeepBook margin manager state: balances, debts, risk, open orders
// Uses DeepBook Indexer /portfolio/:address for margin data
// and /orders/:pool/:balance_manager for open orders

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import './style.css'

const INDEXER = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

interface MarginPosition {
  margin_manager_id: string
  pool: string
  base_asset_symbol: string
  quote_asset_symbol: string
  base_asset: number
  quote_asset: number
  base_debt: number
  quote_debt: number
  base_asset_usd: number
  quote_asset_usd: number
  base_debt_usd: number
  quote_debt_usd: number
  total_debt_usd: number
  net_value_usd: number
  risk_ratio: number
}

interface OrderEntry {
  order_id: string
  balance_manager_id: string
  type: string
  current_status: string
  price: number
  placed_at: number
  original_quantity: number
  filled_quantity: number
  remaining_quantity: number
}

interface ManagerView {
  position: MarginPosition
  orders: OrderEntry[]
  ordersLoading: boolean
}

let sharedHost: SuiHostAPI | null = null

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatNum(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  if (Math.abs(v) < 0.0001 && v !== 0) return v.toFixed(8)
  return v.toFixed(4)
}

function shortenId(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

function riskClass(ratio: number): string {
  if (ratio >= 3) return 'sui-mm__risk--safe'
  if (ratio >= 1.5) return 'sui-mm__risk--warn'
  return 'sui-mm__risk--danger'
}

function riskLabel(ratio: number): string {
  if (ratio >= 3) return 'Safe'
  if (ratio >= 1.5) return 'Caution'
  return 'At Risk'
}

function debtBarClass(ratio: number): string {
  if (ratio >= 3) return 'sui-mm__debt-fill--safe'
  if (ratio >= 1.5) return 'sui-mm__debt-fill--warn'
  return 'sui-mm__debt-fill--danger'
}

function MarginManagerContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [address, setAddress] = useState(() => sharedHost?.getSuiContext().address ?? '')
  const [managers, setManagers] = useState<ManagerView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = INDEXER[network]

  const fetchManagers = useCallback(
    async (addr: string) => {
      if (!addr || !/^0x[a-fA-F0-9]{64}$/.test(addr)) {
        setError('Enter a valid Sui address (0x...64 hex chars)')
        return
      }
      setLoading(true)
      setError(null)
      setManagers([])
      try {
        const res = await fetch(`${base}/portfolio/${addr}`)
        if (!res.ok) throw new Error(`Portfolio API: ${res.status}`)
        const data = await res.json()
        const positions: MarginPosition[] = data.margin_positions ?? []

        if (positions.length === 0) {
          setManagers([])
          setLoading(false)
          return
        }

        // Initialize views without orders
        const views: ManagerView[] = positions.map((p) => ({
          position: p,
          orders: [],
          ordersLoading: true,
        }))
        setManagers(views)
        setLoading(false)

        // Fetch orders for each manager in parallel
        const orderResults = await Promise.allSettled(
          positions.map(async (p) => {
            const bmId = p.margin_manager_id
            const res = await fetch(`${base}/orders/${p.pool}/${bmId}?limit=20&status=Placed`)
            if (!res.ok) return []
            return (await res.json()) as OrderEntry[]
          }),
        )

        setManagers((prev) =>
          prev.map((v, i) => ({
            ...v,
            orders: orderResults[i].status === 'fulfilled' ? orderResults[i].value : [],
            ordersLoading: false,
          })),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    },
    [base],
  )

  // Sync from shared context
  useEffect(() => {
    if (!sharedHost) return
    const unsub = sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
      if (ctx.address) {
        setAddress(ctx.address)
        fetchManagers(ctx.address)
      }
    })
    const ctx = sharedHost.getSuiContext()
    if (ctx.address) {
      setAddress(ctx.address)
      fetchManagers(ctx.address)
    }
    return unsub
  }, [fetchManagers])

  const handleSubmit = () => fetchManagers(address)

  return (
    <div className="sui-mm">
      <div className="sui-mm__header">
        <div className="sui-mm__title-row">
          <h3 className="sui-mm__title">Margin Manager</h3>
          {managers.length > 0 && (
            <button className="sui-mm__refresh" onClick={handleSubmit} disabled={loading}>
              {loading ? '⏳' : '↻'}
            </button>
          )}
        </div>
        <p className="sui-mm__desc">Inspect DeepBook margin positions, debts & open orders</p>
      </div>

      {/* Address input */}
      <div className="sui-mm__input-row">
        <input
          className="sui-mm__input"
          type="text"
          placeholder="0x... wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button className="sui-mm__btn" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Loading...' : 'Inspect'}
        </button>
      </div>

      {error && (
        <div className="sui-mm__error">
          {error}
          <button className="sui-mm__retry" onClick={handleSubmit}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="sui-mm__loading">Loading margin managers...</div>}

      {!loading && managers.length === 0 && !error && address && (
        <div className="sui-mm__empty">No margin managers found for this address</div>
      )}

      {/* Manager cards */}
      {managers.map((m) => {
        const p = m.position
        const equityUsd = p.base_asset_usd + p.quote_asset_usd
        const debtPct = equityUsd > 0 ? Math.min((p.total_debt_usd / equityUsd) * 100, 100) : 0

        return (
          <div key={p.margin_manager_id + p.pool} className="sui-mm__card">
            <div className="sui-mm__card-header">
              <h4 className="sui-mm__card-title">{p.pool}</h4>
              <span className={`sui-mm__risk ${riskClass(p.risk_ratio)}`}>
                {riskLabel(p.risk_ratio)} · {p.risk_ratio.toFixed(2)}x
              </span>
            </div>
            <div className="sui-mm__card-id">{shortenId(p.margin_manager_id)}</div>

            {/* Balances */}
            <div className="sui-mm__grid" style={{ marginTop: 10 }}>
              <div className="sui-mm__item">
                <span className="sui-mm__label">{p.base_asset_symbol} Balance</span>
                <span className="sui-mm__value">{formatNum(p.base_asset)}</span>
                <span className="sui-mm__sub">{formatUsd(p.base_asset_usd)}</span>
              </div>
              <div className="sui-mm__item">
                <span className="sui-mm__label">{p.quote_asset_symbol} Balance</span>
                <span className="sui-mm__value">{formatNum(p.quote_asset)}</span>
                <span className="sui-mm__sub">{formatUsd(p.quote_asset_usd)}</span>
              </div>
              <div className="sui-mm__item">
                <span className="sui-mm__label">{p.base_asset_symbol} Debt</span>
                <span className="sui-mm__value sui-mm__value--red">
                  {p.base_debt > 0 ? formatNum(p.base_debt) : '—'}
                </span>
                {p.base_debt > 0 && (
                  <span className="sui-mm__sub">{formatUsd(p.base_debt_usd)}</span>
                )}
              </div>
              <div className="sui-mm__item">
                <span className="sui-mm__label">{p.quote_asset_symbol} Debt</span>
                <span className="sui-mm__value sui-mm__value--red">
                  {p.quote_debt > 0 ? formatNum(p.quote_debt) : '—'}
                </span>
                {p.quote_debt > 0 && (
                  <span className="sui-mm__sub">{formatUsd(p.quote_debt_usd)}</span>
                )}
              </div>
              <div className="sui-mm__item">
                <span className="sui-mm__label">Total Debt</span>
                <span className="sui-mm__value sui-mm__value--red">
                  {formatUsd(p.total_debt_usd)}
                </span>
              </div>
              <div className="sui-mm__item">
                <span className="sui-mm__label">Net Value</span>
                <span
                  className={`sui-mm__value ${p.net_value_usd >= 0 ? 'sui-mm__value--green' : 'sui-mm__value--red'}`}
                >
                  {formatUsd(p.net_value_usd)}
                </span>
              </div>
            </div>

            {/* Debt ratio bar */}
            {p.total_debt_usd > 0 && (
              <div className="sui-mm__debt-bar-wrap">
                <div className="sui-mm__debt-bar-label">
                  <span>Debt / Equity</span>
                  <span>{debtPct.toFixed(1)}%</span>
                </div>
                <div className="sui-mm__debt-bar">
                  <div
                    className={`sui-mm__debt-fill ${debtBarClass(p.risk_ratio)}`}
                    style={{ width: `${debtPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Open orders */}
            {m.ordersLoading && (
              <div className="sui-mm__sub" style={{ marginTop: 8 }}>
                Loading orders...
              </div>
            )}
            {!m.ordersLoading && m.orders.length > 0 && (
              <>
                <div className="sui-mm__section-title">Open Orders ({m.orders.length})</div>
                <div className="sui-mm__table-wrap">
                  <table className="sui-mm__table">
                    <thead>
                      <tr>
                        <th className="sui-mm__th">Side</th>
                        <th className="sui-mm__th sui-mm__th--right">Price</th>
                        <th className="sui-mm__th sui-mm__th--right">Qty</th>
                        <th className="sui-mm__th sui-mm__th--right">Filled</th>
                        <th className="sui-mm__th sui-mm__th--right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.orders.map((o) => (
                        <tr key={o.order_id} className="sui-mm__row">
                          <td className="sui-mm__td">
                            <span
                              className={`sui-mm__badge ${o.type === 'buy' ? 'sui-mm__badge--buy' : 'sui-mm__badge--sell'}`}
                            >
                              {o.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="sui-mm__td sui-mm__td--right">{formatNum(o.price)}</td>
                          <td className="sui-mm__td sui-mm__td--right">
                            {formatNum(o.original_quantity)}
                          </td>
                          <td className="sui-mm__td sui-mm__td--right sui-mm__td--green">
                            {formatNum(o.filled_quantity)}
                          </td>
                          <td className="sui-mm__td sui-mm__td--right sui-mm__td--muted">
                            {formatNum(o.remaining_quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!m.ordersLoading && m.orders.length === 0 && (
              <div className="sui-mm__sub" style={{ marginTop: 8 }}>
                No open orders
              </div>
            )}
          </div>
        )
      })}

      <div className="sui-mm__footer">
        Data from{' '}
        <a
          href="https://docs.sui.io/standards/deepbookv3-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-mm__link"
        >
          DeepBook v3 Indexer
        </a>
      </div>
    </div>
  )
}

const SuiMarginManagerPlugin: Plugin = {
  name: 'SuiMarginManager',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-margin-manager/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiMarginManager', MarginManagerContent)
    host.log('SuiMarginManager initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiMarginManager] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiMarginManager] unmounted')
  },
}

export default SuiMarginManagerPlugin
