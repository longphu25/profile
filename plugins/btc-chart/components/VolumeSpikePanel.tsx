// BTC Chart — Volume-spike threshold control (toggle + 2x–3x slider).

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
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-header">
        <div className="btc-chart__panel-title">Volume spike</div>
        <button
          type="button"
          className={`btc-chart__ind-btn${enabled ? ' is-on' : ''}`}
          onClick={onToggle}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="btc-chart__spike-row">
        <input
          type="range"
          className="btc-chart__spike-slider"
          min={2}
          max={3}
          step={0.1}
          value={spikeMult}
          disabled={!enabled}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value) * 10) / 10)}
          aria-label="Volume spike threshold"
        />
        <span className="btc-chart__spike-val">{spikeMult.toFixed(1)}×</span>
      </div>
      <div className="btc-chart__spike-hint">
        Đánh dấu + cảnh báo khi volume {'>'} {spikeMult.toFixed(1)}× trung bình 20 nến
      </div>
    </div>
  )
}
