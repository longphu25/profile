// BTC Chart — segmented status strip (connection, session, layers).

import type { VisFlags } from '../storage'
import { IND_LABELS } from '../lib/indicator-groups'

export interface ChartStatusBarProps {
  wsText: string
  wsTone: 'muted' | 'live' | 'err'
  lastUpdate: string
  ofCount: number
  boxCount: number
  vis: VisFlags
}

const LAYER_TAGS: Array<keyof VisFlags> = ['luxNwe', 'vp', 'of', 'boxFlip']

export function ChartStatusBar({
  wsText,
  wsTone,
  lastUpdate,
  ofCount,
  boxCount,
  vis,
}: ChartStatusBarProps) {
  const activeTags = LAYER_TAGS.filter((k) => vis[k])

  return (
    <footer className="btc-chart__status">
      <div className="btc-chart__status-seg btc-chart__status-seg--conn">
        <span
          className={
            wsTone === 'live'
              ? 'btc-chart__status-live'
              : wsTone === 'err'
                ? 'dn'
                : 'btc-chart__status-muted'
          }
        >
          <span className="btc-chart__status-dot" aria-hidden />
          {wsText}
        </span>
      </div>

      <div className="btc-chart__status-seg btc-chart__status-seg--session">
        <span className="btc-chart__status-item">{lastUpdate}</span>
        <span className="btc-chart__status-item">
          OF <b>{ofCount}</b>
        </span>
        <span className="btc-chart__status-item">
          Box <b>{boxCount}</b>
        </span>
      </div>

      <div className="btc-chart__status-seg btc-chart__status-seg--layers">
        {activeTags.length === 0 ? (
          <span className="btc-chart__status-tag">No layers on</span>
        ) : (
          activeTags.map((k) => (
            <span key={k} className="btc-chart__status-layer">
              {IND_LABELS[k] ?? k}
            </span>
          ))
        )}
      </div>
    </footer>
  )
}