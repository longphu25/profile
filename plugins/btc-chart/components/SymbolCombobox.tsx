// BTC Chart — inline symbol picker (Shadow DOM safe, no portal).

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SymbolEntry } from '../lib'

export interface SymbolComboboxProps {
  symbol: string
  symbols: SymbolEntry[]
  onSelect: (sym: string) => void
}

export function SymbolCombobox({ symbol, symbols, onSelect }: SymbolComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const active = symbols.find((s) => s.symbol === symbol)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return symbols
    return symbols.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.base.toLowerCase().includes(q) ||
        `${s.base}/${s.quote}`.toLowerCase().includes(q),
    )
  }, [query, symbols])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={cn('btc-chart__symbol-picker', open && 'is-open')} ref={rootRef}>
      <button
        type="button"
        className="btc-chart__symbol-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select trading pair"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="btc-chart__symbol-trigger-label">
          {active ? `${active.base}/${active.quote}` : symbol}
        </span>
        <span className="btc-chart__symbol-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="btc-chart__symbol-menu" role="listbox" aria-label="Trading pairs">
          <input
            type="search"
            className="btc-chart__symbol-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search trading pairs"
            autoFocus
          />
          <ul className="btc-chart__symbol-list">
            {filtered.length === 0 ? (
              <li className="btc-chart__symbol-empty">No pair found</li>
            ) : (
              filtered.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={symbol === s.symbol}
                    className={cn(
                      'btc-chart__symbol-option',
                      symbol === s.symbol && 'is-active',
                    )}
                    onClick={() => {
                      onSelect(s.symbol)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    {s.base}/{s.quote}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}