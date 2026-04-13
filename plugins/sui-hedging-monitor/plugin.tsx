// SUI Hedging Monitor Plugin
// Connect to a running depbuk-hedging bot instance via its REST/SSE API
// Shows lifecycle, active cycle, PnL, volume, logs, and start/stop controls

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import './style.css'

// Minimal types matching depbuk-hedging RuntimeSnapshot
interface DashboardStats {
  totalVolumeAllTime: number
  totalVolumeToday: number
  sessionPnl: number
  sessionFees: number
  sessionGas: number
  cyclesCompleted: number
}

interface PriceTick {
  price: number
  updatedAt: string
}

interface ActiveCycleState {
  cycleNumber: number
  stage: string
  price: number
  holdStartedAt?: string
  holdEndsAt?: string
  holdSecondsTarget: number
  plannedNotionalUsd: number
  currentQuantity: number
}

interface BotLogEntry {
  level: string
  message: string
  timestamp: string
}

interface BotConfigSummary {
  poolKey: string
  notionalSizeUsd: number
  maxCycles: number | null
  settingsApplyPending: boolean
}

interface RuntimeSnapshot {
  lifecycle: string
  runLabel: string
  message: string
  stats: DashboardStats
  price: PriceTick
  activeCycle: ActiveCycleState | null
  logs: BotLogEntry[]
  config: BotConfigSummary | null
  updatedAt: string
}

let sharedHost: SuiHostAPI | null = null

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function dotClass(runLabel: string): string {
  switch (runLabel) {
    case 'RUNNING':
      return 'sui-hm__dot--running'
    case 'ERROR':
      return 'sui-hm__dot--error'
    case 'BOOTING':
    case 'STOPPING':
      return 'sui-hm__dot--booting'
    default:
      return 'sui-hm__dot--stopped'
  }
}

function HedgingMonitorContent() {
  const [botUrl, setBotUrl] = useState('http://localhost:5187')
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const disconnect = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setConnected(false)
    setSnapshot(null)
  }, [])

  const connect = useCallback(async () => {
    disconnect()
    setLoading(true)
    setError(null)
    try {
      // Test connection with status endpoint
      const res = await fetch(`${botUrl}/api/bot/status`)
      if (!res.ok) throw new Error(`Status API: ${res.status}`)
      const data: RuntimeSnapshot = await res.json()
      setSnapshot(data)
      setConnected(true)

      // Open SSE stream for live updates
      const es = new EventSource(`${botUrl}/api/bot/stream`)
      es.onmessage = (e) => {
        try {
          setSnapshot(JSON.parse(e.data))
        } catch {
          /* ignore parse errors */
        }
      }
      es.onerror = () => {
        setError('SSE connection lost — retrying...')
      }
      esRef.current = es
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [botUrl, disconnect])

  // Cleanup on unmount
  useEffect(
    () => () => {
      esRef.current?.close()
    },
    [],
  )

  const sendAction = useCallback(
    async (action: string) => {
      setActionLoading(true)
      setError(null)
      try {
        const res = await fetch(`${botUrl}/api/bot/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        if (!res.ok) throw new Error(`Control API: ${res.status}`)
        const data: RuntimeSnapshot = await res.json()
        setSnapshot(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setActionLoading(false)
      }
    },
    [botUrl],
  )

  const s = snapshot
  const cycle = s?.activeCycle
  const holdPct =
    cycle?.holdStartedAt && cycle?.holdEndsAt
      ? Math.min(
          100,
          ((Date.now() - new Date(cycle.holdStartedAt).getTime()) /
            (new Date(cycle.holdEndsAt).getTime() - new Date(cycle.holdStartedAt).getTime())) *
            100,
        )
      : 0

  return (
    <div className="sui-hm">
      <div className="sui-hm__header">
        <div className="sui-hm__title-row">
          <h3 className="sui-hm__title">Hedging Monitor</h3>
        </div>
        <p className="sui-hm__desc">Connect to a running DeepBook hedging bot instance</p>
      </div>

      {/* Connect bar */}
      <div className="sui-hm__connect">
        <input
          className="sui-hm__input"
          type="text"
          placeholder="http://localhost:5187"
          value={botUrl}
          onChange={(e) => setBotUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
        />
        {connected ? (
          <button className="sui-hm__btn sui-hm__btn--red" onClick={disconnect}>
            Disconnect
          </button>
        ) : (
          <button className="sui-hm__btn" onClick={connect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {error && <div className="sui-hm__error">{error}</div>}

      {!connected && !loading && (
        <div className="sui-hm__empty">Enter the bot URL and click Connect to start monitoring</div>
      )}

      {s && (
        <>
          {/* Status bar */}
          <div className="sui-hm__status-bar">
            <div className={`sui-hm__dot ${dotClass(s.runLabel)}`} />
            <span className="sui-hm__status-label">{s.runLabel}</span>
            <span className="sui-hm__status-msg">{s.message}</span>
          </div>

          {/* Controls */}
          <div className="sui-hm__controls">
            <button
              className="sui-hm__btn sui-hm__btn--green sui-hm__btn--sm"
              onClick={() => sendAction('start')}
              disabled={actionLoading || s.runLabel === 'RUNNING'}
            >
              Start
            </button>
            <button
              className="sui-hm__btn sui-hm__btn--red sui-hm__btn--sm"
              onClick={() => sendAction('stop-clean')}
              disabled={actionLoading || s.runLabel === 'STOPPED'}
            >
              Stop &amp; Clean
            </button>
          </div>

          {/* Stats */}
          <div className="sui-hm__stats">
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">SUI Price</span>
              <span className="sui-hm__stat-value">{formatUsd(s.price.price)}</span>
            </div>
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">Session PnL</span>
              <span
                className={`sui-hm__stat-value ${s.stats.sessionPnl >= 0 ? 'sui-hm__stat-value--green' : 'sui-hm__stat-value--red'}`}
              >
                {formatUsd(s.stats.sessionPnl)}
              </span>
            </div>
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">Volume Today</span>
              <span className="sui-hm__stat-value">{formatUsd(s.stats.totalVolumeToday)}</span>
            </div>
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">Volume All-Time</span>
              <span className="sui-hm__stat-value">{formatUsd(s.stats.totalVolumeAllTime)}</span>
            </div>
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">Fees</span>
              <span className="sui-hm__stat-value">{formatUsd(s.stats.sessionFees)}</span>
            </div>
            <div className="sui-hm__stat">
              <span className="sui-hm__stat-label">Cycles</span>
              <span className="sui-hm__stat-value">{s.stats.cyclesCompleted}</span>
            </div>
          </div>

          {/* Active cycle */}
          {cycle && (
            <div className="sui-hm__cycle">
              <div className="sui-hm__cycle-title">Active Cycle #{cycle.cycleNumber}</div>
              <div className="sui-hm__cycle-grid">
                <div className="sui-hm__cycle-item">
                  <span className="sui-hm__cycle-label">Stage</span>
                  <span className="sui-hm__cycle-val">{cycle.stage}</span>
                </div>
                <div className="sui-hm__cycle-item">
                  <span className="sui-hm__cycle-label">Price</span>
                  <span className="sui-hm__cycle-val">{formatUsd(cycle.price)}</span>
                </div>
                <div className="sui-hm__cycle-item">
                  <span className="sui-hm__cycle-label">Notional</span>
                  <span className="sui-hm__cycle-val">{formatUsd(cycle.plannedNotionalUsd)}</span>
                </div>
                <div className="sui-hm__cycle-item">
                  <span className="sui-hm__cycle-label">Hold Target</span>
                  <span className="sui-hm__cycle-val">{cycle.holdSecondsTarget}s</span>
                </div>
              </div>
              {cycle.stage === 'holding' && (
                <div className="sui-hm__hold-bar">
                  <div className="sui-hm__hold-fill" style={{ width: `${holdPct}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {s.logs.length > 0 && (
            <div className="sui-hm__logs">
              <div className="sui-hm__logs-title">Runtime Logs</div>
              {s.logs
                .slice(-20)
                .reverse()
                .map((log, i) => (
                  <div key={i} className="sui-hm__log-row">
                    <span className="sui-hm__log-time">{formatTime(log.timestamp)}</span>
                    <span
                      className={`sui-hm__log-msg ${log.level === 'warn' ? 'sui-hm__log-msg--warn' : log.level === 'error' ? 'sui-hm__log-msg--error' : ''}`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="sui-hm__footer">
            {s.config?.poolKey ?? 'N/A'} · Notional: {formatUsd(s.config?.notionalSizeUsd ?? 0)}
            {s.config?.maxCycles != null && ` · Max: ${s.config.maxCycles} cycles`}
          </div>
        </>
      )}
    </div>
  )
}

const SuiHedgingMonitorPlugin: Plugin = {
  name: 'SuiHedgingMonitor',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-hedging-monitor/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiHedgingMonitor', HedgingMonitorContent)
    host.log('SuiHedgingMonitor initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiHedgingMonitor] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiHedgingMonitor] unmounted')
  },
}

export default SuiHedgingMonitorPlugin
