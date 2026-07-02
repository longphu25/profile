// BTC Chart — sidebar accordion with motion expand/collapse.

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { accordionBody, transitionSpring } from '../lib/motion'
import { intelPanelMatches } from '../lib/intel-panels'
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
  /** Flat row style for Intel drawer (no nested card chrome) */
  flat?: boolean
  /** Skip motion height animation (Intel drawer perf) */
  lightweight?: boolean
  /** Hide when intel search does not match title or keywords */
  filterQuery?: string
  /** Extra terms for intel filter (OI, whale, etc.) */
  filterKeywords?: string[]
  /** Open accordion when filter matches (easier to spot results) */
  expandOnFilter?: boolean
  /** Optional callback when accordion is toggled open/closed */
  onToggle?: (open: boolean) => void
}

export function SidebarAccordion({
  title,
  defaultOpen = false,
  children,
  summary,
  badge,
  filterQuery,
  filterKeywords,
  flat = false,
  lightweight = false,
  expandOnFilter = true,
  onToggle,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const visible = intelPanelMatches(title, filterKeywords, filterQuery ?? '')

  useEffect(() => {
    if (!expandOnFilter || !filterQuery?.trim() || !visible) return
    setOpen(true)
  }, [expandOnFilter, filterQuery, visible])

  if (!visible) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    onToggle?.(next)
  }

  return (
    <div
      className={cn(
        'btc-chart__accordion sb-accordion',
        flat && 'btc-chart__accordion--flat',
        open && 'is-open',
      )}
    >
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

      {lightweight ? (
        open ? (
          <div className="btc-chart__accordion-body">{children}</div>
        ) : null
      ) : (
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
      )}
    </div>
  )
}

export { SideBadge }
