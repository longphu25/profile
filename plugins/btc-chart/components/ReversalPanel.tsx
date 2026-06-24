// BTC Chart — Kathy Lien Reversal Panel (collapsible sidebar widget)

import { useState } from 'react'
import { fmtP, type LienResult } from '../lib'

interface Props {
  lien: LienResult
  enabled: boolean
  onToggle: () => void
}

const ZONE_LABEL: Record<string, string> = {
  buy: 'Buy Zone',
  sell: 'Sell Zone',
  neutral: 'Neutral',
}
const ZONE_CLS: Record<string, string> = { buy: 'up', sell: 'dn', neutral: '' }
const REGIME_LABEL: Record<string, string> = {
  trending_up: 'Trend Up',
  trending_down: 'Trend Down',
  range: 'Range',
}

export function ReversalPanel({ lien, enabled, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const hasData = !!lien.dbb
  const sig = lien.latestSignal

  return (
    <div className={`btc-chart__panel btc-chart__lien-panel${!enabled ? ' is-disabled' : ''}`}>
      {/* Compact header */}
      <div className="btc-chart__collapse-hdr">
        <button
          type="button"
          className="btc-chart__collapse-btn"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
          <span>Reversal</span>
          <span className="muted">(Lien)</span>
        </button>
        {/* Summary when collapsed */}
        {!open && hasData && enabled && (
          <span className="btc-chart__collapse-summary">
            <span className={ZONE_CLS[lien.zone]}>{ZONE_LABEL[lien.zone]}</span>
            {sig && (
              <span className={sig.type === 'bullish' ? 'up' : 'dn'}>
                {sig.type === 'bullish' ? '▲REV' : '▼REV'}
              </span>
            )}
            {lien.squeeze.active && <span style={{ color: '#ffc46b' }}>SQZ</span>}
          </span>
        )}
        <button
          type="button"
          className={`btc-chart__collapse-toggle${enabled ? ' is-on' : ''}`}
          onClick={onToggle}
          title={enabled ? 'Tat Lien' : 'Bat Lien'}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Expanded detail */}
      {open && enabled && hasData && (
        <div className="btc-chart__collapse-body">
          <div className="btc-chart__lien-zone">
            <div>
              <span className="lbl">Zone</span>
              <span className={ZONE_CLS[lien.zone]}>{ZONE_LABEL[lien.zone]}</span>
            </div>
            <div>
              <span className="lbl">Regime</span>
              <span
                className={
                  lien.regime.includes('up') ? 'up' : lien.regime.includes('down') ? 'dn' : ''
                }
              >
                {REGIME_LABEL[lien.regime]}
              </span>
            </div>
          </div>

          <div className="btc-chart__lien-bands">
            <div>
              <span className="dn">+2SD</span> {fmtP(lien.dbb!.upper2)}
            </div>
            <div>
              <span className="muted">+1SD</span> {fmtP(lien.dbb!.upper1)}
            </div>
            <div>
              <span style={{ color: '#c792ea' }}>SMA</span> {fmtP(lien.dbb!.sma)}
            </div>
            <div>
              <span className="muted">-1SD</span> {fmtP(lien.dbb!.lower1)}
            </div>
            <div>
              <span className="up">-2SD</span> {fmtP(lien.dbb!.lower2)}
            </div>
          </div>

          {lien.squeeze.active && (
            <div className="btc-chart__lien-squeeze">
              <span className="btc-chart__lien-squeeze-dot" />
              Squeeze ({lien.squeeze.bars} bars)
            </div>
          )}
          {lien.squeeze.breakout && (
            <div
              className={`btc-chart__lien-breakout ${lien.squeeze.breakout === 'up' ? 'up' : 'dn'}`}
            >
              Squeeze breakout {lien.squeeze.breakout === 'up' ? '▲' : '▼'}
            </div>
          )}
          {lien.exhaustion && <div className="btc-chart__lien-exhaust">Momentum exhaustion</div>}
          {lien.bandTouch && (
            <div className={`btc-chart__lien-touch ${lien.bandTouch === 'upper' ? 'dn' : 'up'}`}>
              {lien.bandTouch === 'upper' ? 'Upper' : 'Lower'} band touch
            </div>
          )}

          {sig && (
            <div
              className={`btc-chart__lien-signal ${sig.type === 'bullish' ? 'is-bull' : 'is-bear'}`}
            >
              <div className="btc-chart__lien-sig-head">
                <span className={sig.type === 'bullish' ? 'up' : 'dn'}>
                  {sig.type === 'bullish' ? '▲ BULLISH REV' : '▼ BEARISH REV'}
                </span>
                <span className="muted">{sig.confidence}%</span>
              </div>
              <div className="btc-chart__lien-sig-price">@ {fmtP(sig.price)}</div>
              <div className="btc-chart__lien-sig-reasons">
                {sig.reasons.map((r) => (
                  <span key={r} className="btc-chart__lien-tag">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="btc-chart__lien-adr">
            <span className="lbl">ADR spent</span>
            <span className={lien.adrSpent > 80 ? 'dn' : ''}>{Math.round(lien.adrSpent)}%</span>
          </div>
          <div className="btc-chart__lien-stats">
            <span>Reversals: {lien.reversals.length}</span>
            <span>BW: {lien.dbb!.bandwidth.toFixed(2)}%</span>
          </div>
        </div>
      )}

      {open && !hasData && enabled && (
        <div className="btc-chart__collapse-body">
          <p className="muted">Chua du du lieu (can 20+ nen)</p>
        </div>
      )}
    </div>
  )
}
