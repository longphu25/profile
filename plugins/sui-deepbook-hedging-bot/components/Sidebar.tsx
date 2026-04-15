/**
 * Sidebar — Mini Orderbook + Funding Check + Points Estimator
 */

import type { BotConfig, OBLevel, WalletBalance } from '../types'
import { formatOBPrice, formatQty, formatUsd, shortAddr } from '../utils'

export interface SidebarProps {
  config: BotConfig
  obBids: OBLevel[]
  obAsks: OBLevel[]
  orderPrices: { bid: number | null; ask: number | null }
  addrA: string | null
  addrB: string | null
  balA: WalletBalance
  balB: WalletBalance
}

export function Sidebar({ config, obBids, obAsks, orderPrices, addrA, addrB, balA, balB }: SidebarProps) {
  const midPrice = obBids[0] && obAsks[obAsks.length - 1]
    ? (obBids[0].price + obAsks[obAsks.length - 1].price) / 2
    : 0
  const spreadPct = obBids[0] && obAsks[obAsks.length - 1]
    ? ((obAsks[obAsks.length - 1].price - obBids[0].price) / obBids[0].price) * 100
    : 0
  const perWalletUsd = config.notionalUsd / 2
  const totalNeeded = config.notionalUsd + 0.6
  const [base, quote] = config.pool.split('_')
  const balAOk = balA.coins.length > 0 && balA.coins.some((c) => c.symbol === quote && parseFloat(c.balance) > 0.1)
  const balBOk = balB.coins.length > 0 && balB.coins.some((c) => c.symbol === base && parseFloat(c.balance) > 0.1)

  return (
    <div className="sui-hb__sidebar">
      {/* Orderbook */}
      <div className="sui-hb__card">
        <div className="sui-hb__card-title">{config.pool.replace('_', ' / ')} Orderbook</div>
        {midPrice > 0 && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}>
              {formatOBPrice(midPrice)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Spread: {spreadPct.toFixed(3)}%</div>
          </div>
        )}
        <div className="sui-hb__ob">
          {obAsks.length > 0 ? (
            <>
              <div className="sui-hb__ob-hdr"><span>Price</span><span>Size</span><span>Total</span></div>
              {[...obAsks].reverse().map((l, i) => {
                const isEntry = orderPrices.ask && Math.abs(l.price - orderPrices.ask) / orderPrices.ask < 0.0005
                return (
                  <div key={i} className={`sui-hb__ob-row sui-hb__ob-row--ask ${isEntry ? 'sui-hb__ob-row--mark-sell' : ''}`}>
                    <span>{formatOBPrice(l.price)} {isEntry ? '◄ SELL' : ''}</span>
                    <span>{formatQty(l.size)}</span><span>{formatQty(l.total)}</span>
                  </div>
                )
              })}
              <div className="sui-hb__ob-mid">
                {formatOBPrice(midPrice)}
                {orderPrices.bid && orderPrices.ask && (
                  <span style={{ fontSize: 9, color: '#a78bfa', marginLeft: 4 }}>
                    spread {((orderPrices.ask - orderPrices.bid) / orderPrices.bid * 100).toFixed(3)}%
                  </span>
                )}
              </div>
              {obBids.map((l, i) => {
                const isEntry = orderPrices.bid && Math.abs(l.price - orderPrices.bid) / orderPrices.bid < 0.0005
                return (
                  <div key={i} className={`sui-hb__ob-row sui-hb__ob-row--bid ${isEntry ? 'sui-hb__ob-row--mark-buy' : ''}`}>
                    <span>{formatOBPrice(l.price)} {isEntry ? '◄ BUY' : ''}</span>
                    <span>{formatQty(l.size)}</span><span>{formatQty(l.total)}</span>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="sui-hb__empty">Loading orderbook…</div>
          )}
        </div>
      </div>

      {/* Funding Check */}
      <div className="sui-hb__card">
        <div className="sui-hb__card-title">Funding Check</div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
          <div>Pool: <b style={{ color: '#f8fafc' }}>{base} / {quote}</b></div>
          <div>Notional: <b style={{ color: '#f8fafc' }}>{formatUsd(config.notionalUsd)}</b></div>
          <div style={{ marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 4 }}>
            <div>A (Long/Buy {base}): needs <b style={{ color: '#eab308' }}>{quote}</b> ~{formatUsd(perWalletUsd)} + gas</div>
            <div>B (Short/Sell {base}): needs <b style={{ color: '#eab308' }}>{base}</b> ~{formatUsd(perWalletUsd)} + gas</div>
          </div>
          <div style={{ marginTop: 4 }}>Total: <b style={{ color: '#ef4444' }}>{formatUsd(totalNeeded)}</b> across both tokens</div>
        </div>
        {(addrA || addrB) && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {addrA && (
              <div style={{ padding: '5px 0', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>A: {shortAddr(addrA)}</span>
                  <span style={{ color: balAOk ? '#22c55e' : '#ef4444' }}>{balA.loading ? '…' : balAOk ? '✓' : '✗'}</span>
                </div>
                {!balA.loading && balA.coins.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {balA.coins.map((c, j) => (
                      <span key={j} style={{ fontSize: 9, color: '#94a3b8', background: '#020617', borderRadius: 4, padding: '1px 5px' }}>
                        {c.balance} <span style={{ color: '#64748b' }}>{c.symbol}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {addrB && (
              <div style={{ padding: '5px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>B: {shortAddr(addrB)}</span>
                  <span style={{ color: balBOk ? '#22c55e' : '#ef4444' }}>{balB.loading ? '…' : balBOk ? '✓' : '✗'}</span>
                </div>
                {!balB.loading && balB.coins.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {balB.coins.map((c, j) => (
                      <span key={j} style={{ fontSize: 9, color: '#94a3b8', background: '#020617', borderRadius: 4, padding: '1px 5px' }}>
                        {c.balance} <span style={{ color: '#64748b' }}>{c.symbol}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Points Estimator */}
      <div className="sui-hb__card">
        <div className="sui-hb__card-title">Points Estimator</div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>DeepBook points = maker volume. Maker fee = 0 (free).</div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 2 }}>
          {(() => {
            const n = config.notionalUsd
            const holdAvg = (config.holdMinSec + config.holdMaxSec) / 2
            const cycleTime = holdAvg + 30
            const cyclesPerHour = Math.floor(3600 / cycleTime)
            const cyclesPerDay = cyclesPerHour * 24
            const volPerDay = n * 2 * cyclesPerDay
            const volPerWeek = volPerDay * 7
            const volPerMonth = volPerDay * 30
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cycle time (avg)</span><b style={{ color: '#f8fafc' }}>{Math.round(cycleTime)}s</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cycles / hour</span><b style={{ color: '#f8fafc' }}>{cyclesPerHour}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cycles / day</span><b style={{ color: '#f8fafc' }}>{cyclesPerDay}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: 4 }}><span>Volume / day</span><b style={{ color: '#22c55e' }}>{formatUsd(volPerDay)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volume / week</span><b style={{ color: '#22c55e' }}>{formatUsd(volPerWeek)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volume / month</span><b style={{ color: '#22c55e' }}>{formatUsd(volPerMonth)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: 4 }}><span>Est. points / day</span><b style={{ color: '#a78bfa' }}>~{Math.round(volPerDay).toLocaleString()}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Est. points / week</span><b style={{ color: '#a78bfa' }}>~{Math.round(volPerWeek).toLocaleString()}</b></div>
              </>
            )
          })()}
        </div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>* Maker fee = 0. Points ≈ 1pt/$1 maker vol (estimate). Bot tab must stay open.</div>
      </div>
    </div>
  )
}
