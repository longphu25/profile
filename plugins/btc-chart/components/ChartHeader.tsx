// BTC Chart — header: pair selector, custom-coin add, interval tabs, price/OHLCV.

import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { stitchEase } from '../lib/motion'
import { SymbolCombobox } from './SymbolCombobox'
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
  sidebarOpen?: boolean
  onToggleTools?: () => void
  onToggleSidebar?: () => void
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
  sidebarOpen = false,
  onToggleTools,
  onToggleSidebar,
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
          <Input
            name="coin"
            placeholder="+coin"
            className="btc-chart__custom-input h-7 w-[4.5rem] rounded-none border-[var(--border)] bg-[var(--surface-2)] px-2 font-mono text-[10px] shadow-none focus-visible:ring-[var(--mint)]"
            aria-label="Add custom coin"
          />
        </form>
      </div>

      <div className="btc-chart__header-price">
        <div className="btc-chart__price">
          <motion.span
            key={price.cur}
            className={cn('btc-chart__price-cur', price.up ? 'up' : 'dn')}
            initial={{ opacity: 0.55, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: stitchEase }}
          >
            {price.cur}
          </motion.span>
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
            aria-label="Toggle sidebar"
          >
            Intel
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