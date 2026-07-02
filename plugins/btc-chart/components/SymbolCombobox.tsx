// BTC Chart — searchable symbol picker (shadcn Command + Popover).

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { SymbolEntry } from '../lib'

export interface SymbolComboboxProps {
  symbol: string
  symbols: SymbolEntry[]
  onSelect: (sym: string) => void
}

export function SymbolCombobox({ symbol, symbols, onSelect }: SymbolComboboxProps) {
  const [open, setOpen] = useState(false)
  const active = symbols.find((s) => s.symbol === symbol)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select trading pair"
          className="btc-chart__symbol-combo h-7 w-[7.5rem] justify-between rounded-none border-[var(--border)] bg-[var(--surface-2)] px-2 font-mono text-[10px] shadow-none hover:bg-[var(--surface-3)]"
        >
          <span className="truncate">
            {active ? `${active.base}/${active.quote}` : symbol}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] rounded-none border-[var(--border-strong)] bg-[var(--surface-2)] p-0"
        align="start"
      >
        <Command className="rounded-none bg-transparent">
          <CommandInput
            placeholder="Search pair…"
            className="h-8 font-mono text-[11px]"
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-[10px] text-[var(--muted)]">
              No pair found.
            </CommandEmpty>
            <CommandGroup>
              {symbols.map((s) => (
                <CommandItem
                  key={s.symbol}
                  value={`${s.base} ${s.quote} ${s.symbol}`}
                  className="font-mono text-[11px]"
                  onSelect={() => {
                    onSelect(s.symbol)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3 w-3',
                      symbol === s.symbol ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {s.base}/{s.quote}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}