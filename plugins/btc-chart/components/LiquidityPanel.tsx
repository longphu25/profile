// BTC Chart — ICT Liquidity panel: trading range + equilibrium, external
// (BSL/SSL) vs internal liquidity, inverse-FVG count, latest sweep, and the
// current liquidity draw target. Collapsed by default; header shows a compact
// summary, click to expand.

import { useState } from 'react'
import { fmtP, type LiquidityResult } from '../lib'

interface Props {
  liquidity: LiquidityResult
}

export function LiquidityPanel({ liquidity }: Props) {
  const [open, setOpen] = useState(false)

  const { range } = liquidity
  const lastSweep = liquidity.sweeps[liquidity.sweeps.length - 1]
  const lastIfvg = liquidity.inverseFvgs[liquidity.inverseFvgs.length - 1]
  const internalCount = liquidity.levels.filter((l) => l.side === 'internal').length
  const externalCount = liquidity.levels.filter((l) => l.side === 'external').length

  if (!range) {
    return (
      <div className="btc-chart__panel btc-chart__sessions-panel">
        <div className="btc-chart__sessions-hdr btc-chart__sessions-hdr--static">
          <span className="btc-chart__sessions-title">Liquidity</span>
          <span className="btc-chart__sessions-summary muted">Chưa đủ dữ liệu</span>
        </div>
      </div>
    )
  }

  const target = liquidity.nextTarget

  return (
    <div className={`btc-chart__panel btc-chart__sessions-panel${open ? ' is-open' : ''}`}>
      <button type="button" className="btc-chart__sessions-hdr" onClick={() => setOpen((o) => !o)}>
        <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
        <span className="btc-chart__sessions-title">Liquidity</span>
        <span className="btc-chart__sessions-summary">
          {range.hasBOS && <span className="btc-chart__sessions-chip">BOS</span>}
          {lastSweep && (
            <span className={lastSweep.type === 'bullish' ? 'up' : 'dn'}>
              {lastSweep.type === 'bullish' ? '▲Sweep' : '▼Sweep'}
            </span>
          )}
          {target && <span className="btc-chart__sessions-adr-mini">→ {fmtP(target.price)}</span>}
        </span>
      </button>

      {open && (
        <div className="btc-chart__sessions-body">
          <div className="btc-chart__sessions-asia">
            <div className="btc-chart__sessions-row">
              <span className="btc-chart__sessions-key">Range High (BSL)</span>
              <span className="btc-chart__sessions-val up">{fmtP(range.high)}</span>
            </div>
            <div className="btc-chart__sessions-row">
              <span className="btc-chart__sessions-key">Equilibrium</span>
              <span className="btc-chart__sessions-val">{fmtP(range.equilibrium)}</span>
            </div>
            <div className="btc-chart__sessions-row">
              <span className="btc-chart__sessions-key">Range Low (SSL)</span>
              <span className="btc-chart__sessions-val dn">{fmtP(range.low)}</span>
            </div>
          </div>

          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">BOS</span>
            <span
              className={
                'btc-chart__sessions-val ' +
                (range.bosBias === 'bull' ? 'up' : range.bosBias === 'bear' ? 'dn' : 'muted')
              }
            >
              {range.hasBOS ? `Có (${range.bosBias})` : 'Chưa'}
            </span>
          </div>

          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">Liquidity pools</span>
            <span className="btc-chart__sessions-val">
              {externalCount} ext · {internalCount} int
            </span>
          </div>

          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">Inverse FVG</span>
            <span className="btc-chart__sessions-val">
              {lastIfvg ? (
                <span className={lastIfvg.flippedBias === 'bull' ? 'up' : 'dn'}>
                  {lastIfvg.flippedBias === 'bull' ? '▲ bull' : '▼ bear'} (
                  {liquidity.inverseFvgs.length})
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </span>
          </div>

          <div className="btc-chart__sessions-judas">
            <span className="btc-chart__sessions-key">Sweep gần nhất</span>
            {lastSweep ? (
              <div
                className={
                  'btc-chart__sessions-judas-tag ' + (lastSweep.type === 'bullish' ? 'up' : 'dn')
                }
              >
                {lastSweep.type === 'bullish' ? '▲ Long' : '▼ Short'} · quét{' '}
                {lastSweep.side === 'high' ? 'BSL' : 'SSL'} @ {fmtP(lastSweep.level)}
                {lastSweep.inKillzone ? ' · KZ✦' : ''} · {lastSweep.confidence}%
              </div>
            ) : (
              <span className="btc-chart__sessions-val muted">Chưa phát hiện</span>
            )}
          </div>

          {target && (
            <div className="btc-chart__sessions-row">
              <span className="btc-chart__sessions-key">Draw kế tiếp</span>
              <span className="btc-chart__sessions-val">
                {target.label} @ {fmtP(target.price)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
