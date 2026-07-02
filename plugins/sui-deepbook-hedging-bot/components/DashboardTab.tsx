/**
 * Dashboard Tab — bot status, stats, hold progress, history, logs.
 */

import type { BotStage, BotConfig, LogEntry, CycleRecord } from '../types'
import { formatUsd, formatOBPrice } from '../utils'

export interface DashboardTabProps {
  running: boolean
  stage: BotStage
  config: BotConfig
  cycleNum: number
  currentPrice: number | null
  totalPnl: number
  totalVolume: number
  holdStart: number | null
  holdEnd: number | null
  addrA: string | null
  addrB: string | null
  network: string
  history: CycleRecord[]
  logs: LogEntry[]
  setLogs: (fn: (l: LogEntry[]) => LogEntry[]) => void
}

export function DashboardTab(props: DashboardTabProps) {
  const {
    running,
    stage,
    config,
    cycleNum,
    currentPrice,
    totalPnl,
    totalVolume,
    holdStart,
    holdEnd,
    addrA,
    addrB,
    network,
    history,
    logs,
    setLogs,
  } = props

  const holdProgress =
    holdStart && holdEnd
      ? Math.min(100, ((Date.now() - holdStart) / (holdEnd - holdStart)) * 100)
      : 0
  const holdRemaining = holdEnd ? Math.max(0, Math.ceil((holdEnd - Date.now()) / 1000)) : 0

  return (
    <>
      {/* Status */}
      <div className="sui-hb__status">
        <div className={`sui-hb__dot sui-hb__dot--${running ? stage : 'stopped'}`} />
        <span className="sui-hb__status-text">
          {running ? stage.toUpperCase() : 'STOPPED'}
          {stage === 'holding' && holdRemaining > 0 && ` (${holdRemaining}s)`}
        </span>
      </div>

      {/* Stats grid */}
      <div className="sui-hb__stats">
        {[
          { label: 'Price', value: currentPrice ? formatOBPrice(currentPrice) : '—' },
          {
            label: 'PnL',
            value: formatUsd(totalPnl),
            color: totalPnl >= 0 ? '#22c55e' : '#ef4444',
          },
          { label: 'Volume', value: formatUsd(totalVolume) },
          { label: 'Est. Points', value: `~${Math.round(totalVolume)}` },
          {
            label: 'Cycles',
            value: `${cycleNum}${config.maxCycles ? `/${config.maxCycles}` : ''}`,
          },
          { label: 'Pool', value: config.pool },
        ].map((s) => (
          <div key={s.label} className="sui-hb__stat">
            <span className="sui-hb__stat-label">{s.label}</span>
            <span className="sui-hb__stat-value" style={s.color ? { color: s.color } : undefined}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Hold progress */}
      {stage === 'holding' && holdEnd && (
        <div className="sui-hb__hold">
          <div className="sui-hb__hold-bar">
            <div className="sui-hb__hold-fill" style={{ width: `${holdProgress}%` }} />
          </div>
          <span className="sui-hb__hold-text">{holdRemaining}s remaining</span>
        </div>
      )}

      {/* Accounts */}
      {(addrA || addrB) && (
        <div className="sui-hb__card" style={{ marginTop: 8 }}>
          {addrA && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
              A:{' '}
              <a
                href={`https://suiscan.xyz/${network}/account/${addrA}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#4da2ff',
                  textDecoration: 'none',
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {addrA.slice(0, 10)}…{addrA.slice(-4)}
              </a>
            </div>
          )}
          {addrB && (
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              B:{' '}
              <a
                href={`https://suiscan.xyz/${network}/account/${addrB}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#a78bfa',
                  textDecoration: 'none',
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {addrB.slice(0, 10)}…{addrB.slice(-4)}
              </a>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="sui-hb__card" style={{ marginTop: 8 }}>
          <div className="sui-hb__card-title">History</div>
          <div style={{ maxHeight: 150, overflow: 'auto' }}>
            {history.map((h) => (
              <div
                key={h.num}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  padding: '3px 0',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                <span style={{ color: '#64748b' }}>#{h.num}</span>
                <span style={{ color: '#94a3b8', fontFamily: "'Fira Code', monospace" }}>
                  {formatOBPrice(h.openPrice)} → {formatOBPrice(h.closePrice)}
                </span>
                <span style={{ color: h.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {formatUsd(h.pnl)}
                </span>
                <span style={{ color: '#475569' }}>{h.duration}s</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="sui-hb__card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="sui-hb__card-title">Logs</div>
          <button
            type="button"
            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
            onClick={() => setLogs(() => [])}
          >
            Clear
          </button>
        </div>
        <div className="sui-hb__logs">
          {logs.length === 0 ? (
            <div className="sui-hb__empty">No logs yet</div>
          ) : (
            [...logs].reverse().map((l, i) => (
              <div key={i} className={`sui-hb__log sui-hb__log--${l.level}`}>
                <span className="sui-hb__log-icon">
                  {l.level === 'success'
                    ? '✓'
                    : l.level === 'error'
                      ? '✗'
                      : l.level === 'warn'
                        ? '!'
                        : '·'}
                </span>
                <span className="sui-hb__log-time">
                  {new Date(l.ts).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="sui-hb__log-msg">{l.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
