// BTC Chart — segmented status strip (connection, session, layers).

import { cn } from '@/lib/utils'
import type { PipelineRefreshPhase } from '../lib/chart-render-context'
import type { VisFlags } from '../storage'
import { IND_LABELS } from '../lib/indicator-groups'

export interface ChartStatusBarProps {
  wsText: string
  wsTone: 'muted' | 'live' | 'err'
  pipelinePhase: PipelineRefreshPhase
  lastUpdate: string
  ofCount: number
  boxCount: number
  vis: VisFlags
}

const LAYER_TAGS: Array<keyof VisFlags> = ['luxNwe', 'vp', 'of', 'boxFlip']

export function ChartStatusBar({
  wsText,
  wsTone,
  pipelinePhase,
  lastUpdate,
  ofCount,
  boxCount,
  vis,
}: ChartStatusBarProps) {
  const activeTags = LAYER_TAGS.filter((k) => vis[k])
  const showRefreshSplit = pipelinePhase !== 'idle'

  return (
    <footer className="btc-chart__status">
      <div className="btc-chart__status-track">
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
            <span className="btc-chart__status-conn-text">{wsText}</span>
          </span>
        </div>

        <div className="btc-chart__status-seg btc-chart__status-seg--session">
          {showRefreshSplit && (
            <span
              className={cn(
                'btc-chart__status-split',
                pipelinePhase === 'fast' && 'is-fast',
                pipelinePhase === 'heavy' && 'is-heavy',
              )}
              aria-label="Chart refresh pipeline 80/20"
              title="Fast paint 80%, deferred heavy 20%"
            >
              <span className="btc-chart__status-split-part">80</span>
              <span className="btc-chart__status-split-sep">/</span>
              <span className="btc-chart__status-split-part">20</span>
            </span>
          )}
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
            <span className="btc-chart__status-tag">No layers</span>
          ) : (
            activeTags.map((k) => (
              <span key={k} className="btc-chart__status-layer">
                {IND_LABELS[k] ?? k}
              </span>
            ))
          )}
        </div>
      </div>
    </footer>
  )
}
