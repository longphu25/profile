// BTC Chart — ICT Sessions panel: active session, Asian range, killzone
// status, latest Judas swing, and ADR% spent. Collapsed by default; the header
// shows a compact one-line summary, click to expand full detail.

import { useState } from 'react'
import { fmtP, type ICTResult } from '../lib'

interface Props {
  ict: ICTResult
}

const SESSION_LABEL: Record<string, string> = {
  asia: 'Á (Asia)',
  london: 'Âu (London)',
  ny: 'Mỹ (New York)',
}

export function SessionsPanel({ ict }: Props) {
  const [open, setOpen] = useState(false)

  const activeKz = ict.killzones.find((k) => k.active)
  const lastJudas = ict.judas[ict.judas.length - 1]
  const asiaToday = [...ict.sessions].reverse().find((s) => s.name === 'asia')

  if (!ict.sessions.length) {
    return (
      <div className="btc-chart__panel btc-chart__sessions-panel">
        <div className="btc-chart__sessions-hdr btc-chart__sessions-hdr--static">
          <span className="btc-chart__sessions-title">ICT Sessions</span>
          <span className="btc-chart__sessions-summary muted">Chỉ khả dụng ở 1m–1h</span>
        </div>
      </div>
    )
  }

  const sessionShort = ict.activeSession
    ? SESSION_LABEL[ict.activeSession].replace(/\s*\(.*\)/, '')
    : '—'

  return (
    <div className={`btc-chart__panel btc-chart__sessions-panel${open ? ' is-open' : ''}`}>
      <button type="button" className="btc-chart__sessions-hdr" onClick={() => setOpen((o) => !o)}>
        <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
        <span className="btc-chart__sessions-title">ICT Sessions</span>
        <span className="btc-chart__sessions-summary">
          <span className={activeKz ? 'btc-chart__sessions-kz-on' : ''}>{sessionShort}</span>
          {activeKz && <span className="btc-chart__sessions-chip">KZ</span>}
          <span className="btc-chart__sessions-adr-mini">ADR {ict.adrPct.toFixed(0)}%</span>
          {lastJudas && (
            <span className={lastJudas.type === 'bullish' ? 'up' : 'dn'}>
              {lastJudas.type === 'bullish' ? '▲J' : '▼J'}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="btc-chart__sessions-body">
          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">Phiên hiện tại</span>
            <span className="btc-chart__sessions-val">
              {ict.activeSession ? SESSION_LABEL[ict.activeSession] : '—'}
            </span>
          </div>

          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">Killzone</span>
            <span
              className={'btc-chart__sessions-val ' + (activeKz ? 'btc-chart__sessions-kz-on' : '')}
            >
              {activeKz
                ? `${activeKz.name === 'london' ? 'London' : 'NY'} ACTIVE`
                : 'Ngoài killzone'}
            </span>
          </div>

          {asiaToday && (
            <div className="btc-chart__sessions-asia">
              <div className="btc-chart__sessions-row">
                <span className="btc-chart__sessions-key">Asia High</span>
                <span className="btc-chart__sessions-val up">{fmtP(asiaToday.high)}</span>
              </div>
              <div className="btc-chart__sessions-row">
                <span className="btc-chart__sessions-key">Asia Low</span>
                <span className="btc-chart__sessions-val dn">{fmtP(asiaToday.low)}</span>
              </div>
            </div>
          )}

          <div className="btc-chart__sessions-row">
            <span className="btc-chart__sessions-key">ADR đã dùng</span>
            <span className="btc-chart__sessions-val">{ict.adrPct.toFixed(0)}%</span>
          </div>
          <div className="btc-chart__sessions-adr">
            <div
              className="btc-chart__sessions-adr-fill"
              style={{
                width: `${Math.min(100, ict.adrPct)}%`,
                background: ict.adrPct > 85 ? '#ff7a85' : ict.adrPct > 60 ? '#ffc46b' : '#34d8a4',
              }}
            />
          </div>

          <div className="btc-chart__sessions-judas">
            <span className="btc-chart__sessions-key">Judas Swing</span>
            {lastJudas ? (
              <div
                className={
                  'btc-chart__sessions-judas-tag ' + (lastJudas.type === 'bullish' ? 'up' : 'dn')
                }
              >
                {lastJudas.type === 'bullish' ? '▲ Long' : '▼ Short'} · sweep Asia{' '}
                {lastJudas.sweptSide === 'high' ? 'H' : 'L'} @ {fmtP(lastJudas.sweptLevel)}
                {lastJudas.volConfirm ? ' · VOL✦' : ''} · {lastJudas.confidence}%
              </div>
            ) : (
              <span className="btc-chart__sessions-val muted">Chưa phát hiện</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
