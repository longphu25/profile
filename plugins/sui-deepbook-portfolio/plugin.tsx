// SUI DeepBook Portfolio Plugin
// View margin positions, collateral, LP positions, and DeepBook points
// Uses /portfolio/:address and /get_points endpoints

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

interface CollateralBalance {
  asset: string
  balance: number
  balance_usd: number
}

interface LpPosition {
  margin_pool_id: string
  asset: string
  supplied: number
  shares: number
  supplied_usd: number
}

interface PortfolioSummary {
  total_equity_usd: number
  total_debt_usd: number
  net_value_usd: number
}

interface Portfolio {
  margin_positions: MarginPosition[]
  collateral_balances: CollateralBalance[]
  lp_positions: LpPosition[]
  summary: PortfolioSummary
}

interface PointsEntry {
  address: string
  total_points: number
}

let sharedHost: SuiHostAPI | null = null

function formatUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatNum(v: number): string {
  if (v === 0) return '0'
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  if (v < 0.0001 && v > 0) return v.toFixed(8)
  return v.toFixed(4)
}

function shortenId(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

function PortfolioContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [address, setAddress] = useState(() => sharedHost?.getSuiContext().address ?? '')
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [points, setPoints] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = INDEXER[network]

  const fetchPortfolio = useCallback(
    async (addr: string) => {
      if (!addr || !/^0x[a-fA-F0-9]{64}$/.test(addr)) {
        setError('Enter a valid Sui address (0x...64 hex chars)')
        return
      }
      setLoading(true)
      setError(null)
      setPortfolio(null)
      setPoints(null)
      try {
        const [pRes, ptRes] = await Promise.all([
          fetch(`${base}/portfolio/${addr}`),
          fetch(`${base}/get_points?addresses=${addr}`),
        ])
        if (!pRes.ok) throw new Error(`Portfolio API: ${pRes.status}`)
        const pData: Portfolio = await pRes.json()
        setPortfolio(pData)

        if (ptRes.ok) {
          const ptData: PointsEntry[] = await ptRes.json()
          const entry = ptData.find((e) => e.address.toLowerCase() === addr.toLowerCase())
          setPoints(entry?.total_points ?? 0)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [base],
  )

  // Sync address from shared context
  useEffect(() => {
    if (!sharedHost) return
    const unsub = sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
      if (ctx.address) {
        setAddress(ctx.address)
        fetchPortfolio(ctx.address)
      }
    })
    // Initial load if connected
    const ctx = sharedHost.getSuiContext()
    if (ctx.address) {
      setAddress(ctx.address)
      fetchPortfolio(ctx.address)
    }
    return unsub
  }, [fetchPortfolio])

  const handleSubmit = () => fetchPortfolio(address)

  const mp = portfolio?.margin_positions ?? []
  const cb = portfolio?.collateral_balances ?? []
  const lp = portfolio?.lp_positions ?? []
  const sum = portfolio?.summary

  return (
    <div className="sui-portfolio">
      <div className="sui-portfolio__header">
        <div className="sui-portfolio__title-row">
          <h3 className="sui-portfolio__title">DeepBook Portfolio</h3>
          {points !== null && (
            <span className="sui-portfolio__points">⚡ {points.toLocaleString()} pts</span>
          )}
        </div>
        <p className="sui-portfolio__desc">Margin positions, collateral & LP on DeepBook v3</p>
      </div>

      {/* Address input */}
      <div className="sui-portfolio__input-row">
        <input
          className="sui-portfolio__input"
          type="text"
          placeholder="0x... wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button className="sui-portfolio__btn" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {error && (
        <div className="sui-portfolio__error">
          {error}
          <button className="sui-portfolio__retry" onClick={handleSubmit}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="sui-portfolio__loading">Loading portfolio...</div>}

      {/* Summary */}
      {sum && (
        <div className="sui-portfolio__summary">
          <div className="sui-portfolio__stat">
            <span className="sui-portfolio__stat-label">Total Equity</span>
            <span className="sui-portfolio__stat-value">{formatUsd(sum.total_equity_usd)}</span>
          </div>
          <div className="sui-portfolio__stat">
            <span className="sui-portfolio__stat-label">Total Debt</span>
            <span className="sui-portfolio__stat-value sui-portfolio__stat-value--red">
              {formatUsd(sum.total_debt_usd)}
            </span>
          </div>
          <div className="sui-portfolio__stat">
            <span className="sui-portfolio__stat-label">Net Value</span>
            <span
              className={`sui-portfolio__stat-value ${sum.net_value_usd >= 0 ? 'sui-portfolio__stat-value--green' : 'sui-portfolio__stat-value--red'}`}
            >
              {formatUsd(sum.net_value_usd)}
            </span>
          </div>
        </div>
      )}

      {/* Margin Positions */}
      {mp.length > 0 && (
        <>
          <div className="sui-portfolio__section-title">Margin Positions</div>
          <div className="sui-portfolio__table-wrap">
            <table className="sui-portfolio__table">
              <thead>
                <tr>
                  <th className="sui-portfolio__th">Pool</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Base</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Quote</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Debt</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Net Value</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {mp.map((p) => (
                  <tr key={p.margin_manager_id + p.pool} className="sui-portfolio__row">
                    <td className="sui-portfolio__td">
                      <div>{p.pool}</div>
                      <div className="sui-portfolio__sub">{shortenId(p.margin_manager_id)}</div>
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      <div>
                        {formatNum(p.base_asset)} {p.base_asset_symbol}
                      </div>
                      <div className="sui-portfolio__sub">{formatUsd(p.base_asset_usd)}</div>
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      <div>
                        {formatNum(p.quote_asset)} {p.quote_asset_symbol}
                      </div>
                      <div className="sui-portfolio__sub">{formatUsd(p.quote_asset_usd)}</div>
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right sui-portfolio__td--red">
                      {formatUsd(p.total_debt_usd)}
                    </td>
                    <td
                      className={`sui-portfolio__td sui-portfolio__td--right ${p.net_value_usd >= 0 ? 'sui-portfolio__td--green' : 'sui-portfolio__td--red'}`}
                    >
                      {formatUsd(p.net_value_usd)}
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right sui-portfolio__td--muted">
                      {p.risk_ratio.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Collateral */}
      {cb.length > 0 && (
        <>
          <div className="sui-portfolio__section-title">Collateral Balances</div>
          <div className="sui-portfolio__table-wrap">
            <table className="sui-portfolio__table">
              <thead>
                <tr>
                  <th className="sui-portfolio__th">Asset</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Balance</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">USD Value</th>
                </tr>
              </thead>
              <tbody>
                {cb.map((c) => (
                  <tr key={c.asset} className="sui-portfolio__row">
                    <td className="sui-portfolio__td">{c.asset}</td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      {formatNum(c.balance)}
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      {formatUsd(c.balance_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LP Positions */}
      {lp.length > 0 && (
        <>
          <div className="sui-portfolio__section-title">LP Positions</div>
          <div className="sui-portfolio__table-wrap">
            <table className="sui-portfolio__table">
              <thead>
                <tr>
                  <th className="sui-portfolio__th">Asset</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">Supplied</th>
                  <th className="sui-portfolio__th sui-portfolio__th--right">USD Value</th>
                </tr>
              </thead>
              <tbody>
                {lp.map((l) => (
                  <tr key={l.margin_pool_id} className="sui-portfolio__row">
                    <td className="sui-portfolio__td">
                      <div>{l.asset}</div>
                      <div className="sui-portfolio__sub">{shortenId(l.margin_pool_id)}</div>
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      {formatNum(l.supplied)}
                    </td>
                    <td className="sui-portfolio__td sui-portfolio__td--right">
                      {formatUsd(l.supplied_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state */}
      {portfolio && mp.length === 0 && cb.length === 0 && lp.length === 0 && (
        <div className="sui-portfolio__empty">No DeepBook positions found for this address</div>
      )}

      <div className="sui-portfolio__footer">
        Data from{' '}
        <a
          href="https://docs.sui.io/standards/deepbookv3-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-portfolio__link"
        >
          DeepBook v3 Indexer
        </a>
      </div>
    </div>
  )
}

const SuiDeepBookPortfolioPlugin: Plugin = {
  name: 'SuiDeepBookPortfolio',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-portfolio/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiDeepBookPortfolio', PortfolioContent)
    host.log('SuiDeepBookPortfolio initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiDeepBookPortfolio] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookPortfolio] unmounted')
  },
}

export default SuiDeepBookPortfolioPlugin
