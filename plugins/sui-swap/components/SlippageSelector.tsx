import type { FC } from 'react'

interface SlippageSelectorProps {
  value: number
  onChange: (slippage: number) => void
  options?: number[]
}

/** Slippage tolerance selector — SRP: only handles slippage UI */
export const SlippageSelector: FC<SlippageSelectorProps> = ({
  value,
  onChange,
  options = [0.1, 0.5, 1.0],
}) => (
  <div className="sui-swap__slippage">
    <span className="sui-swap__slippage-label">Slippage</span>
    <div className="sui-swap__slippage-options">
      {options.map((s) => (
        <button
          key={s}
          className={`sui-swap__slippage-btn ${value === s ? 'sui-swap__slippage-btn--active' : ''}`}
          onClick={() => onChange(s)}
        >
          {s}%
        </button>
      ))}
    </div>
  </div>
)
