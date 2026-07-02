// BTC Chart — skeleton loading overlay with motion fade-out.

import { AnimatePresence, motion } from 'motion/react'
import { loadingOverlay } from '../lib/motion'

export interface ChartLoadingOverlayProps {
  loading: boolean
  text: string
}

export function ChartLoadingOverlay({ loading, text }: ChartLoadingOverlayProps) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="btc-chart__loading"
          role="status"
          aria-busy="true"
          variants={loadingOverlay}
          initial="visible"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="btc-chart__load-skeleton" aria-hidden>
            <div className="btc-chart__load-skeleton-bar btc-chart__load-skeleton-bar--wide" />
            <div className="btc-chart__load-skeleton-bar" />
            <div className="btc-chart__load-skeleton-bar btc-chart__load-skeleton-bar--short" />
          </div>
          <span className="btc-chart__loading-text">{text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
