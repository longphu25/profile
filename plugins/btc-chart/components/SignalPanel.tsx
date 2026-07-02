// BTC Chart — ML signal gauge and its feature-weight breakdown.

import React from 'react'
import { detectSignalConflict, FEATURE_LABEL, type MLResult, type TradeSetup } from '../lib'
import { SideBlock, SideHero, SideBody, StatGrid, StatCell } from './sidebar'

export const SignalPanel = React.memo(function SignalPanel({
  ml,
  setup,
}: {
  ml: MLResult
  setup?: TradeSetup
}) {
  const pct = Math.round(ml.score * 100)
  const conflict = setup ? detectSignalConflict(ml, setup) : null

  return (
    <SideBlock variant="signal">
      <SideHero
        kicker="ML Signal"
        title={ml.label}
        pct={pct}
        color={ml.color}
        hint="Bias tổng hợp · không thay thế confluence entry"
      />
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
