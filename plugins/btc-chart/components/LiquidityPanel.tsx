// BTC Chart — ICT Liquidity: range, BSL/SSL, sweeps, next target.

import { useState } from 'react'
import React from 'react'
import { fmtP, type LiquidityResult } from '../lib'
import {
  SideBlock,
  SideHead,
  SideBody,
  StatGrid,
  StatCell,
  SideBadge,
  SideRow,
  SideNote,
  SideEmpty,
} from './sidebar'

interface Props {
  liquidity: LiquidityResult
}

export const LiquidityPanel = React.memo(function LiquidityPanel({ liquidity }: Props) {
  const [open, setOpen] = useState(false)

  const { range } = liquidity
  const lastSweep = liquidity.sweeps[liquidity.sweeps.length - 1]
  const lastIfvg = liquidity.inverseFvgs[liquidity.inverseFvgs.length - 1]
  const internalCount = liquidity.levels.filter((l) => l.side === 'internal').length
  const externalCount = liquidity.levels.filter((l) => l.side === 'external').length

  if (!range) {
    return (
      <SideBlock variant="context">
        <SideHead title="Liquidity" subtitle="ICT range model" />
        <SideEmpty>Chưa đủ dữ liệu để xác định range</SideEmpty>
      </SideBlock>
    )
  }

  const target = liquidity.nextTarget
  const bosTone = range.bosBias === 'bull' ? 'up' : range.bosBias === 'bear' ? 'dn' : ''

  return (
    <SideBlock variant="context">
      <SideHead
        title="Liquidity"
        subtitle="Premium / discount"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          <>
            {range.hasBOS && <SideBadge tone="mint">BOS</SideBadge>}
            {lastSweep && (
              <SideBadge tone={lastSweep.type === 'bullish' ? 'up' : 'dn'}>
                {lastSweep.type === 'bullish' ? 'SWEEP ▲' : 'SWEEP ▼'}
              </SideBadge>
            )}
          </>
        }
        summary={target ? `→ ${fmtP(target.price)}` : undefined}
      />

      {open && (
        <SideBody>
          <StatGrid cols={3}>
            <StatCell label="High" value={fmtP(range.high)} tone="dn" />
            <StatCell label="EQ 50%" value={fmtP(range.equilibrium)} tone="neu" />
            <StatCell label="Low" value={fmtP(range.low)} tone="up" />
          </StatGrid>

          <div className="sb-panel-grid">
            <SideRow
              label="BOS bias"
              value={range.hasBOS ? range.bosBias.toUpperCase() : '—'}
              tone={bosTone}
            />
            <SideRow label="Pools" value={`${externalCount}E · ${internalCount}I`} />
            <SideRow
              label="iFVG"
              value={
                lastIfvg
                  ? `${lastIfvg.flippedBias === 'bull' ? '▲' : '▼'} ${liquidity.inverseFvgs.length}`
                  : '—'
              }
            />
            <SideRow label="Next draw" value={target ? fmtP(target.price) : '—'} tone="neu" />
          </div>

          {lastSweep && (
            <>
              <div className="sb-divider" />
              <SideNote>
                <span className={lastSweep.type === 'bullish' ? 'up' : 'dn'}>
                  Last sweep {lastSweep.side.toUpperCase()}
                </span>
                {lastSweep.inKillzone ? ' · Killzone' : ''} · {lastSweep.confidence}% conf
              </SideNote>
            </>
          )}
        </SideBody>
      )}
    </SideBlock>
  )
})
