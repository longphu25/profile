// BTC Chart — Volume-spike threshold control (toggle + 2x–3x slider).

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface VolumeSpikePanelProps {
  enabled: boolean
  onToggle: () => void
  spikeMult: number
  onChange: (value: number) => void
}

export function VolumeSpikePanel({
  enabled,
  onToggle,
  spikeMult,
  onChange,
}: VolumeSpikePanelProps) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">Volume spike</div>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={onToggle}
        >
          {enabled ? 'On' : 'Off'}
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="range"
          className="flex-1 accent-[var(--mint)]"
          min={2}
          max={3}
          step={0.1}
          value={spikeMult}
          disabled={!enabled}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value) * 10) / 10)}
          aria-label="Volume spike threshold"
        />
        <span className="font-mono text-xs w-8 tabular-nums text-right">
          {spikeMult.toFixed(1)}×
        </span>
      </div>
      <div className="mt-1 text-[10px] text-[var(--muted)]">
        Mark + alert when volume &gt; {spikeMult.toFixed(1)}× avg (20 bars)
      </div>
    </Card>
  )
}
