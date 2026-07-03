// BTC Chart — floating entry to Signal + Trade Setup on mobile.

import { cn } from '@/lib/utils'
import type { TradeSetup } from '../lib/trade-setup'

export interface MobileSetupFabProps {
  visible: boolean
  setup: TradeSetup | null
  onOpen: () => void
}

export function MobileSetupFab({ visible, setup, onOpen }: MobileSetupFabProps) {
  if (!visible) return null

  const hasSetup = setup?.dir != null
  const label = hasSetup
    ? `${setup.dir === 'long' ? 'LONG' : 'SHORT'} ${setup.confidence}%`
    : 'Signal & Setup'

  return (
    <button
      type="button"
      className={cn('btc-chart__setup-fab', hasSetup && `is-${setup.dir}`)}
      onClick={onOpen}
      aria-label="Mở Signal và Trade Setup"
    >
      <span className="btc-chart__setup-fab-label">{label}</span>
      <span className="btc-chart__setup-fab-hint" aria-hidden>
        {hasSetup ? 'Trade Setup' : 'Chưa có setup'}
      </span>
    </button>
  )
}
