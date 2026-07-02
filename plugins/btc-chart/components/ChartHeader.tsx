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
  activeLayerCount?: number
  toolsOpen?: boolean
  onToggleTools?: () => void
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
  activeLayerCount = 0,
  toolsOpen = false,
  onToggleTools,
  onSelectSymbol,
  onSelectInterval,
  onAddCustomSymbol,
}: ChartHeaderProps) {
  return (
    <header className="btc-chart__header">
      <div className="btc-chart__header-left">
        <div className="btc-chart__brand" aria-hidden>
          <div className="btc-chart__brand-mark">M</div>
          <span className="btc-chart__brand-label">Meridian</span>
        </div>

        <div className="btc-chart__pair">
          {symbolInfo.base}
          <small>/{symbolInfo.quote}</small>
        </div>

        <select
          value={symbol}
          onChange={(e) => onSelectSymbol(e.target.value)}
          className="btc-chart__symbol-select"
          aria-label="Select trading pair"
        >
          {symbols.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.base}/{s.quote}
            </option>
          ))}
        </select>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const input = (e.target as HTMLFormElement).elements.namedItem(
              'coin',
            ) as HTMLInputElement
            onAddCustomSymbol(input.value)
            input.value = ''
          }}
          className="btc-chart__custom-sym"
        >
          <input
            name="coin"
            placeholder="+coin"
            className="btc-chart__custom-input"
            aria-label="Add custom coin"
          />
        </form>
      </div>

      <div className="btc-chart__header-price">
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
      </div>

      <div className="btc-chart__header-controls">
        {onToggleTools && (
          <button
            type="button"
            className={`btc-chart__tools-trigger${toolsOpen ? ' is-on' : ''}`}
            onClick={onToggleTools}
            aria-expanded={toolsOpen}
            aria-haspopup="dialog"
            title="Layers & tools"
          >
            <span className="btc-chart__tools-trigger-label">Tools</span>
            {activeLayerCount > 0 && (
              <span className="btc-chart__tools-trigger-count">{activeLayerCount}</span>
            )}
          </button>
        )}

        <div className="btc-chart__intervals">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => onSelectInterval(iv)}
              className={`btc-chart__iv-btn${interval === iv ? ' is-active' : ''}`}
            >
              {iv.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="btc-chart__live">
          <span className="btc-chart__live-dot" />
          LIVE
        </div>
      </div>
    </header>
  )
}
