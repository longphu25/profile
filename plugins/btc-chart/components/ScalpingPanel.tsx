// BTC Chart — Boucher M1 Scalping Panel (collapsible sidebar widget)

import { useState } from 'react'
import { fmtP, type BoucherResult } from '../lib'

interface Props {
  scalp: BoucherResult
  interval: string
  enabled: boolean
  onToggle: () => void
}

export function ScalpingPanel({ scalp, interval, enabled, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const lastEntry = scalp.entries[scalp.entries.length - 1]
  const hasData = scalp.atr > 0 && scalp.boxSize > 0

  return (
    <div className={`btc-chart__panel btc-chart__scalp-panel${!enabled ? ' is-disabled' : ''}`}>
      {/* Compact header (always visible) */}
      <div className="btc-chart__collapse-hdr">
        <button
          type="button"
          className="btc-chart__collapse-btn"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
          <span>Scalping M1</span>
          <span className="muted">(Boucher)</span>
        </button>
        {/* Summary when collapsed */}
        {!open && hasData && enabled && (
          <span className="btc-chart__collapse-summary">
            <span className={scalp.speed === 'fast' ? 'up' : scalp.speed === 'slow' ? 'dn' : ''}>
              {scalp.speed === 'fast' ? 'FAST' : scalp.speed === 'slow' ? 'SLOW' : 'OK'}
            </span>
            {lastEntry && (
              <span className={lastEntry.dir === 'long' ? 'up' : 'dn'}>
                {lastEntry.dir === 'long' ? '▲' : '▼'}
              </span>
            )}
            <span className="muted">WR:{Math.round(scalp.stats.rr * 100)}%</span>
          </span>
        )}
        <button
          type="button"
          className={`btc-chart__collapse-toggle${enabled ? ' is-on' : ''}`}
          onClick={onToggle}
          title={enabled ? 'Tat Boucher' : 'Bat Boucher'}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Expanded detail */}
      {open && enabled && hasData && (
        <div className="btc-chart__collapse-body">
          {interval !== '1m' && <div className="btc-chart__scalp-warn">Nen dung M1</div>}
          <div className="btc-chart__scalp-grid">
            <div className="btc-chart__scalp-metric">
              <span className="lbl">Box</span>
              <span>{fmtP(scalp.boxSize)}</span>
            </div>
            <div className="btc-chart__scalp-metric">
              <span className="lbl">ATR</span>
              <span>{fmtP(scalp.atr)}</span>
            </div>
            <div className="btc-chart__scalp-metric">
              <span className="lbl">Envelope</span>
              <span className="dn">{fmtP(scalp.envelope)}</span>
            </div>
            <div className="btc-chart__scalp-metric">
              <span className="lbl">Target</span>
              <span className="up">{fmtP(scalp.target)}</span>
            </div>
          </div>

          <div className="btc-chart__scalp-speed">
            <span className="lbl">Speed</span>
            <span className={scalp.speed === 'fast' ? 'up' : scalp.speed === 'slow' ? 'dn' : ''}>
              {scalp.speed === 'fast'
                ? 'FAST (momentum)'
                : scalp.speed === 'slow'
                  ? 'SLOW (mean-rev)'
                  : 'Normal'}
            </span>
          </div>

          {scalp.currentBox && (
            <div className="btc-chart__scalp-box">
              <span className="lbl">Box</span>
              <span>
                {fmtP(scalp.currentBox.low)} - {fmtP(scalp.currentBox.high)}
              </span>
              <span className="muted"> ({scalp.currentBox.bars} bars)</span>
            </div>
          )}

          {lastEntry && (
            <div
              className={`btc-chart__scalp-entry ${lastEntry.dir === 'long' ? 'is-long' : 'is-short'}`}
            >
              <div className="btc-chart__scalp-entry-head">
                <span className={lastEntry.dir === 'long' ? 'up' : 'dn'}>
                  {lastEntry.dir === 'long' ? '▲ BUY' : '▼ SELL'}
                </span>
                {lastEntry.confirmed && <span className="btc-chart__scalp-confirmed">3-Bar</span>}
              </div>
              <div className="btc-chart__scalp-entry-detail">
                <span>@ {fmtP(lastEntry.price)}</span>
                <span className="muted">Level {fmtP(lastEntry.level)}</span>
              </div>
            </div>
          )}

          <div className="btc-chart__scalp-stats">
            <span>3-Bar: {scalp.threeBar.length}</span>
            <span>Entries: {scalp.stats.signals}</span>
            <span className={scalp.stats.rr >= 0.6 ? 'up' : scalp.stats.rr < 0.4 ? 'dn' : ''}>
              WR: {Math.round(scalp.stats.rr * 100)}%
            </span>
          </div>

          {scalp.ladder.length > 0 && (
            <div className="btc-chart__scalp-ladder">
              <span className="lbl">Ladder</span>
              {scalp.ladder.slice(0, 6).map((l) => (
                <div key={l.price} className="btc-chart__scalp-lvl">
                  <span className={l.role === 'resistance' ? 'dn' : 'up'}>
                    {l.role === 'resistance' ? 'R' : 'S'}
                  </span>
                  <span>{fmtP(l.price)}</span>
                  <span className="muted">({l.touches})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open && !hasData && enabled && (
        <div className="btc-chart__collapse-body">
          <p className="muted">Chua du du lieu</p>
        </div>
      )}
    </div>
  )
}
