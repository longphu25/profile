// BTC Chart — ML signal gauge and its feature-weight breakdown.

import React from 'react'
import { FEATURE_LABEL, type MLResult } from '../lib'
import { SideBlock, SideHero, SideBody, StatGrid, StatCell } from './sidebar'

export const SignalPanel = React.memo(function SignalPanel({ ml }: { ml: MLResult }) {
  const pct = Math.round(ml.score * 100)

  return (
    <SideBlock variant="signal">
      <SideHero
        kicker="ML Signal"
        title={ml.label}
        pct={pct}
        color={ml.color}
        hint="Lux NWE · MA50/200 · RSI · MACD confluence"
      />
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
