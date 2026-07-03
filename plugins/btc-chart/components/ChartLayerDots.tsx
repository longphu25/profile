// BTC Chart — layer on/off dots on the chart stage.

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VisFlags } from '../storage'
import { IND_LABELS } from '../lib/indicator-groups'

const CHART_LAYERS: Array<keyof VisFlags> = ['vp', 'of', 'smc', 'ict']

export interface ChartLayerDotsProps {
  vis: VisFlags
  onToggle: (key: keyof VisFlags) => void
  onOpenTools?: () => void
}

export function ChartLayerDots({ vis, onToggle, onOpenTools }: ChartLayerDotsProps) {
  return (
    <div className="btc-chart__layer-dots" role="toolbar" aria-label="Chart layers">
      {CHART_LAYERS.map((key) => {
        const on = !!vis[key]
        return (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            className={cn('btc-chart__layer-dot', on && 'is-on')}
            aria-pressed={on}
            title={
              key === 'smc' && on
                ? 'SMC on: FVG/OB/BOS trên chart. Xem legend (FVG ▲▼) hoặc bật Liquidity panel.'
                : `${IND_LABELS[key] ?? key}${on ? ' (on)' : ' (off)'}`
            }
            onClick={() => onToggle(key)}
            onDoubleClick={onOpenTools}
          >
            <span className="btc-chart__layer-dot-mark" aria-hidden />
            <span className="btc-chart__layer-dot-label">{IND_LABELS[key] ?? key}</span>
          </Button>
        )
      })}
    </div>
  )
}
