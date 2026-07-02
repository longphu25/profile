// BTC Chart — generic sidebar accordion wrapper.

import { useState, type ReactNode } from 'react'
import { SideBadge } from './sidebar'

interface Props {
  title: string
  /** Start open (default false) */
  defaultOpen?: boolean
  children: ReactNode
  /** Optional one-line summary when collapsed */
  summary?: ReactNode
  /** Optional badge in header */
  badge?: ReactNode
  /** Optional callback when accordion is toggled open/closed */
  onToggle?: (open: boolean) => void
}

export function SidebarAccordion({
  title,
  defaultOpen = false,
  children,
  summary,
  badge,
  onToggle,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`btc-chart__accordion sb-accordion${open ? ' is-open' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        className="btc-chart__accordion-hdr"
        onClick={() => {
          const next = !open
          setOpen(next)
          onToggle?.(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const next = !open
            setOpen(next)
            onToggle?.(next)
          }
        }}
      >
        <span className="btc-chart__accordion-caret">{open ? '▾' : '▸'}</span>
        <span className="btc-chart__accordion-title">{title}</span>
        {!open && badge && <span className="sb-head__badges">{badge}</span>}
        {!open && summary && <span className="sb-head__summary">{summary}</span>}
        <span className="btc-chart__accordion-rule" aria-hidden />
      </div>
      {open && <div className="btc-chart__accordion-body">{children}</div>}
    </div>
  )
}

export { SideBadge }
