// BTC Chart — ML signal gauge and its feature-weight breakdown.

import React, { useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectSignalConflict } from '../lib/signal-conflict'
import { ALL_FEATURES } from '../lib/signal-config'
import { FEATURE_LABEL } from '../lib/ml'
import type { MLResult } from '../lib/types'
import type { SignalConfig } from '../lib/signal-config'
import type { TradeSetup } from '../lib/trade-setup'
import { SideBlock, SideHero, SideBody, StatGrid, StatCell } from './sidebar/SidebarBlocks'
import { SignalConfigBody } from './SignalConfigPanel'

export const SignalPanel = React.memo(function SignalPanel({
  ml,
  setup,
  signalConfig,
  onSignalConfigChange,
}: {
  ml: MLResult
  setup?: TradeSetup
  signalConfig: SignalConfig
  onSignalConfigChange: (cfg: SignalConfig) => void
}) {
  const [configOpen, setConfigOpen] = useState(false)
  const pct = Math.round(ml.score * 100)
  const conflict = setup ? detectSignalConflict(ml, setup) : null
  const enabledCount = ALL_FEATURES.filter((k) => signalConfig[k]).length

  return (
    <SideBlock variant="signal">
      <SideHero
        kicker="ML Signal"
        title={ml.label}
        pct={pct}
        color={ml.color}
        hint="Bias tổng hợp · không thay thế confluence entry"
        actions={
          <button
            type="button"
            className={cn('sb-hero__icon-btn', configOpen && 'is-on')}
            onClick={() => setConfigOpen((o) => !o)}
            aria-expanded={configOpen}
            aria-label="Signal settings"
            title={`Signal config (${enabledCount}/${ALL_FEATURES.length})`}
          >
            <Settings size={13} strokeWidth={2} aria-hidden />
          </button>
        }
      />
      {configOpen && (
        <div className="sb-signal-config">
          <SignalConfigBody config={signalConfig} onChange={onSignalConfigChange} />
        </div>
      )}
      {conflict?.hasConflict && (
        <p className="sb-signal-conflict sb-signal-conflict--inline" role="status">
          {conflict.message}
        </p>
      )}
    </SideBlock>
  )
})

export function FeatureWeightsPanel({ ml }: { ml: MLResult }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 6 }}>
          Feature Weights
        </div>
        <StatGrid cols={2}>
          {Object.entries(ml.features).map(([k, v]) => (
            <StatCell
              key={k}
              label={FEATURE_LABEL[k] ?? k}
              value={`${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
              tone={v >= 0 ? 'up' : 'dn'}
            />
          ))}
        </StatGrid>
      </SideBody>
    </SideBlock>
  )
}
