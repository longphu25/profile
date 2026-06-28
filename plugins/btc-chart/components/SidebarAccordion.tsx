// BTC Chart — generic sidebar accordion wrapper.

import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  /** Start open (default false) */
  defaultOpen?: boolean
  children: ReactNode
  /** Optional callback when accordion is toggled open/closed */
  onToggle?: (open: boolean) => void
}

export function SidebarAccordion({ title, defaultOpen = false, children, onToggle }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`btc-chart__panel btc-chart__accordion${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="btc-chart__accordion-hdr"
        onClick={() => {
          const next = !open
          setOpen(next)
          onToggle?.(next)
        }}
      >
        <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
        <span>{title}</span>
      </button>
      {open && <div className="btc-chart__accordion-body">{children}</div>}
    </div>
  )
}
