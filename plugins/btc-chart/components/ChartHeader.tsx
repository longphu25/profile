// BTC Chart — header: pair selector, custom-coin add, interval tabs, price/OHLCV.

import {
  INTERVALS,
  type Interval,
  type SymbolEntry,
  type PriceState,
  type OhlcvState,
} from '../lib'

export interface ChartHeaderProps {
  symbolInfo: SymbolEntry
  symbol: string
  symbols: SymbolEntry[]
  interval: Interval
  price: PriceState
  ohlcv: OhlcvState
  onSelectSymbol: (sym: string) => void
  onSelectInterval: (iv: Interval) => void
  onAddCustomSymbol: (raw: string) => void
}

export function ChartHeader({
  symbolInfo,
  symbol,
  symbols,
  interval,
  price,
  ohlcv,
  onSelectSymbol,
  onSelectInterval,
  onAddCustomSymbol,
}: ChartHeaderProps) {
  return (
    <div className="btc-chart__header">
      <span className="btc-chart__pair">
        {symbolInfo.base}
        <small>/ {symbolInfo.quote}</small>
      </span>
      <select
        className="btc-chart__symbol-select"
        value={symbol}
        onChange={(e) => onSelectSymbol(e.target.value)}
        aria-label="Select trading pair"
      >
        {symbols.map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.base}/{s.quote}
          </option>
        ))}
      </select>
      <form
        className="btc-chart__custom-sym"
        onSubmit={(e) => {
          e.preventDefault()
          const input = (e.target as HTMLFormElement).elements.namedItem('coin') as HTMLInputElement
          onAddCustomSymbol(input.value)
          input.value = ''
        }}
      >
        <input
          name="coin"
          className="btc-chart__custom-input"
          placeholder="+ coin"
          aria-label="Add custom coin"
        />
      </form>
      <div className="btc-chart__intervals">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            type="button"
            className={`btc-chart__iv-btn${interval === iv ? ' is-active' : ''}`}
            onClick={() => onSelectInterval(iv)}
          >
            {iv.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="btc-chart__price">
        <span className={`btc-chart__price-cur ${price.up ? 'up' : 'dn'}`}>{price.cur}</span>
        <span className={`btc-chart__price-chg ${price.up ? 'up' : 'dn'}`}>{price.chg}</span>
      </div>
      <div className="btc-chart__ohlcv">
        <span>
          O <span>{ohlcv.o}</span>
        </span>
        <span>
          H <span>{ohlcv.h}</span>
        </span>
        <span>
          L <span>{ohlcv.l}</span>
        </span>
        <span>
          C <span>{ohlcv.c}</span>
        </span>
        <span>
          V <span>{ohlcv.v}</span>
        </span>
      </div>
      <div className="btc-chart__live">
        <span className="btc-chart__live-dot" />
        Live
      </div>
    </div>
  )
}
