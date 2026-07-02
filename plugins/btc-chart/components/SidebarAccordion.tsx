// BTC Chart — sidebar accordion with motion expand/collapse.

import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { accordionBody, transitionSpring } from '../lib/motion'
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

  const toggle = () => {
    const next = !open
    setOpen(next)
    onToggle?.(next)
  }

  return (
    <div className={cn('btc-chart__accordion sb-accordion', open && 'is-open')}>
      <button
        type="button"
        className="btc-chart__accordion-hdr"
        aria-expanded={open}
        onClick={toggle}
      >
        <motion.span
          className="btc-chart__accordion-caret"
          aria-hidden
          animate={{ rotate: open ? 90 : 0 }}
          transition={transitionSpring}
        >
          ▸
        </motion.span>
        <span className="btc-chart__accordion-title">{title}</span>
        {!open && badge && <span className="sb-head__badges">{badge}</span>}
        {!open && summary && <span className="sb-head__summary">{summary}</span>}
        <span className="btc-chart__accordion-rule" aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="btc-chart__accordion-body"
            variants={accordionBody}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            transition={transitionSpring}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { SideBadge }
