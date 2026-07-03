// BTC Chart — header: pair selector, custom-coin add, interval tabs, price/OHLCV.

import { m } from '../lib/btc-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { stitchEase } from '../lib/motion'
import { SymbolCombobox } from './SymbolCombobox'
import { INTERVALS, type Interval } from '../lib/constants'
import type { SymbolEntry } from '../lib/symbols'
import type { OhlcvState, PriceState } from '../lib/types'

export interface ChartHeaderProps {
  symbolInfo: SymbolEntry
  symbol: string
  symbols: SymbolEntry[]
  interval: Interval
  price: PriceState
  ohlcv: OhlcvState
  activeLayerCount?: number
  toolsOpen?: boolean
  sidebarOpen?: boolean
  intelOpen?: boolean
  onToggleTools?: () => void
  onToggleSidebar?: () => void
  onToggleIntel?: () => void
  onSelectSymbol: (sym: string) => void
  onSelectInterval: (iv: Interval) => void
  onAddCustomSymbol: (raw: string) => void
}

export function ChartHeader({
  symbolInfo: _symbolInfo,
  symbol,
  symbols,
  interval,
  price,
  ohlcv,
  activeLayerCount = 0,
  toolsOpen = false,
  sidebarOpen = false,
  intelOpen = false,
  onToggleTools,
  onToggleSidebar,
  onToggleIntel,
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

        <SymbolCombobox symbol={symbol} symbols={symbols} onSelect={onSelectSymbol} />

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
            placeholder="+"
            className="btc-chart__custom-input"
            aria-label="Add custom coin"
            title="Add custom coin"
          />
        </form>
      </div>

      <div className="btc-chart__header-price">
        <div className="btc-chart__price">
          <m.span
            key={price.cur}
            className={cn('btc-chart__price-cur', price.up ? 'up' : 'dn')}
            initial={{ opacity: 0.55, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: stitchEase }}
          >
            {price.cur}
          </m.span>
          <span className={cn('btc-chart__price-chg', price.up ? 'up' : 'dn')}>{price.chg}</span>
        </div>

        <div className="btc-chart__ohlcv-grid" aria-label="OHLCV">
          <div className="btc-chart__ohlcv-cell">
            <span className="btc-chart__ohlcv-key">O</span>
            <span className="btc-chart__ohlcv-val">{ohlcv.o}</span>
          </div>
          <div className="btc-chart__ohlcv-cell">
            <span className="btc-chart__ohlcv-key">H</span>
            <span className="btc-chart__ohlcv-val">{ohlcv.h}</span>
          </div>
          <div className="btc-chart__ohlcv-cell">
            <span className="btc-chart__ohlcv-key">L</span>
            <span className="btc-chart__ohlcv-val">{ohlcv.l}</span>
          </div>
          <div className="btc-chart__ohlcv-cell">
            <span className="btc-chart__ohlcv-key">C</span>
            <span className="btc-chart__ohlcv-val">{ohlcv.c}</span>
          </div>
          <div className="btc-chart__ohlcv-cell btc-chart__ohlcv-cell--vol">
            <span className="btc-chart__ohlcv-key">V</span>
            <span className="btc-chart__ohlcv-val">{ohlcv.v}</span>
          </div>
        </div>
      </div>

      <div className="btc-chart__header-controls">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'btc-chart__sidebar-trigger h-8 rounded-none px-3 md:hidden',
              sidebarOpen && 'is-on',
            )}
            onClick={onToggleSidebar}
            aria-expanded={sidebarOpen}
            aria-label="Mở trade setup, funding, context, strategies"
          >
            Rail
          </Button>
        )}

        {onToggleIntel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('btc-chart__intel-trigger h-8 rounded-none px-3', intelOpen && 'is-on')}
            onClick={onToggleIntel}
            aria-expanded={intelOpen}
            aria-haspopup="dialog"
            title="Intel panels"
          >
            <span className="btc-chart__intel-trigger-label">Intel</span>
          </Button>
        )}

        {onToggleTools && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('btc-chart__tools-trigger h-8 rounded-none px-3', toolsOpen && 'is-on')}
            onClick={onToggleTools}
            aria-expanded={toolsOpen}
            aria-haspopup="dialog"
            title="Layers & tools"
          >
            <span className="btc-chart__tools-trigger-label">Tools</span>
            {activeLayerCount > 0 && (
              <Badge
                variant="secondary"
                className="btc-chart__tools-trigger-count ml-1.5 h-4 min-w-4 rounded-none border-[var(--border-strong)] bg-[var(--surface-3)] px-1 font-mono text-[9px] tabular-nums"
              >
                {activeLayerCount}
              </Badge>
            )}
          </Button>
        )}

        <div className="btc-chart__intervals" role="group" aria-label="Chart interval">
          {INTERVALS.map((iv) => (
            <Button
              key={iv}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectInterval(iv)}
              className={cn(
                'btc-chart__iv-btn h-7 rounded-none px-2.5 font-mono text-[10px] tracking-wider',
                interval === iv && 'is-active',
              )}
              aria-pressed={interval === iv}
            >
              {iv.toUpperCase()}
            </Button>
          ))}
        </div>

        <Badge
          variant="outline"
          className="btc-chart__live gap-1.5 rounded-none border-[var(--border-strong)] bg-transparent px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.18em] text-[var(--mint)]"
        >
          <span className="btc-chart__live-dot" aria-hidden />
          LIVE
        </Badge>
      </div>
    </header>
  )
}
