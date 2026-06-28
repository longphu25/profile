// BTC Chart — indicator toggles + tools (heatmap, sound, notif, PNG, import/export).

import type { VisFlags } from '../storage'

const IND_BUTTONS: { key: keyof VisFlags; label: string; sep?: boolean }[] = [
  { key: 'nwe', label: 'MH Band' },
  { key: 'ma50', label: 'MA50' },
  { key: 'ma200', label: 'MA200' },
  { key: 'dbb', label: 'DBB' },
  { key: 'smc', label: 'SMC' },
  { key: 'boxFlip', label: 'Box Flip' },
  { key: 'of', label: 'Order Flow' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'rsiDiv', label: 'RSI Div' },
  { key: 'scalping', label: 'Scalping' },
  { key: 'reversal', label: 'Reversal' },
  { key: 'vp', label: 'Vol Profile', sep: true },
  { key: 'vol', label: 'Volume' },
  { key: 'volSpike', label: 'Vol Spike' },
]

export interface IndicatorToolbarProps {
  vis: VisFlags
  onToggle: (key: keyof VisFlags) => void
  heatmap: boolean
  onToggleHeatmap: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  notifAllowed: boolean
  onRequestNotif: () => void
  onSnapshot: () => void
  onExport: () => void
  onImport: (file: File) => void
}

export function IndicatorToolbar({
  vis,
  onToggle,
  heatmap,
  onToggleHeatmap,
  soundEnabled,
  onToggleSound,
  notifAllowed,
  onRequestNotif,
  onSnapshot,
  onExport,
  onImport,
}: IndicatorToolbarProps) {
  return (
    <div className="btc-chart__toolbar">
      <span className="btc-chart__tb-label">Indicators</span>
      {IND_BUTTONS.map((b, idx) => (
        <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {b.sep && idx > 0 && <span className="btc-chart__sep">·</span>}
          <button
            type="button"
            className={`btc-chart__ind-btn${vis[b.key] ? ' is-on' : ''}`}
            onClick={() => onToggle(b.key)}
          >
            {b.label}
          </button>
        </span>
      ))}

      <span className="btc-chart__sep">·</span>
      <button
        type="button"
        className={`btc-chart__ind-btn${heatmap ? ' is-on' : ''}`}
        onClick={onToggleHeatmap}
        title="Toggle heatmap behind volume profile"
      >
        Heatmap
      </button>

      <div className="btc-chart__tb-spacer" />

      <button
        type="button"
        className={`btc-chart__ind-btn${soundEnabled ? ' is-on' : ''}`}
        onClick={onToggleSound}
        title="Sound on alert"
        aria-label="Toggle alert sound"
      >
        {soundEnabled ? 'Sound on' : 'Sound off'}
      </button>
      <button
        type="button"
        className={`btc-chart__ind-btn${notifAllowed ? ' is-on' : ''}`}
        onClick={onRequestNotif}
        title="Browser notifications"
      >
        {notifAllowed ? 'Notif on' : 'Notif…'}
      </button>
      <button type="button" className="btc-chart__ind-btn" onClick={onSnapshot}>
        PNG
      </button>
      <button type="button" className="btc-chart__ind-btn" onClick={onExport}>
        Export
      </button>
      <label className="btc-chart__ind-btn btc-chart__file" title="Import config JSON">
        Import
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
