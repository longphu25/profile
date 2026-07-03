// BTC Chart — animated toast stack (alert + import errors).

import { AnimatePresence, m } from '../lib/btc-motion'
import { Button } from '@/components/ui/button'
import { toastItem, transitionFast } from '../lib/motion'

export interface ChartToastsProps {
  alertMessage: string | null
  onDismissAlert: () => void
  errorMessage: string | null
  onDismissError: () => void
}

export function ChartToasts({
  alertMessage,
  onDismissAlert,
  errorMessage,
  onDismissError,
}: ChartToastsProps) {
  return (
    <div className="btc-chart__toast-stack" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {alertMessage && (
          <m.div
            key="alert"
            className="btc-chart__toast"
            role="status"
            variants={toastItem}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitionFast}
            layout
          >
            <span className="btc-chart__toast-tag">ALERT</span>
            <span>{alertMessage}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="btc-chart__toast-x h-6 w-6 shrink-0"
              onClick={onDismissAlert}
              aria-label="Dismiss"
            >
              ×
            </Button>
          </m.div>
        )}
        {errorMessage && (
          <m.div
            key="import-err"
            className="btc-chart__toast btc-chart__toast--err"
            role="alert"
            variants={toastItem}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitionFast}
            layout
          >
            <span className="btc-chart__toast-tag">IMPORT</span>
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="btc-chart__toast-x h-6 w-6 shrink-0"
              onClick={onDismissError}
              aria-label="Dismiss"
            >
              ×
            </Button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
