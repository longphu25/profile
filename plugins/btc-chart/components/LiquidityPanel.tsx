// BTC Chart — ICT Liquidity: range, BSL/SSL, sweeps, next target.

import { useState } from 'react'
import React from 'react'
import { fmtP } from '../lib/format'
import type { LiquidityResult } from '../lib/liquidity'
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
} from './sidebar/SidebarBlocks'

interface Props {
  liquidity: LiquidityResult
  enabled: boolean
  onToggle: () => void
}

function OnOffToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`btc-chart__collapse-toggle${enabled ? ' is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {enabled ? 'ON' : 'OFF'}
    </button>
  )
}

export const LiquidityPanel = React.memo(function LiquidityPanel({
  liquidity,
  enabled,
  onToggle,
}: Props) {
  const [open, setOpen] = useState(false)

  const { range } = liquidity
  const lastSweep = liquidity.sweeps[liquidity.sweeps.length - 1]
  const lastIfvg = liquidity.inverseFvgs[liquidity.inverseFvgs.length - 1]
  const internalCount = liquidity.levels.filter((l) => l.side === 'internal').length
  const externalCount = liquidity.levels.filter((l) => l.side === 'external').length
  const hasData = !!range

  if (!hasData) {
    return (
      <SideBlock variant="context" className={!enabled ? 'is-disabled' : ''}>
        <SideHead
          title="Liquidity"
          subtitle="ICT range model"
          collapsible
          open={open}
          onToggle={() => setOpen((o) => !o)}
          actions={<OnOffToggle enabled={enabled} onToggle={onToggle} />}
        />
        {open && enabled && <SideEmpty>Chưa đủ dữ liệu để xác định range</SideEmpty>}
      </SideBlock>
    )
  }

  const target = liquidity.nextTarget
  const bosTone = range.bosBias === 'bull' ? 'up' : range.bosBias === 'bear' ? 'dn' : ''

  return (
    <SideBlock variant="context" className={!enabled ? 'is-disabled' : ''}>
      <SideHead
        title="Liquidity"
        subtitle="Premium / discount"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open && enabled ? (
            <>
              {range.hasBOS && <SideBadge tone="mint">BOS</SideBadge>}
              {lastSweep && (
                <SideBadge tone={lastSweep.type === 'bullish' ? 'up' : 'dn'}>
                  {lastSweep.type === 'bullish' ? 'SWEEP ▲' : 'SWEEP ▼'}
                </SideBadge>
              )}
            </>
          ) : undefined
        }
        summary={!open && enabled && target ? `→ ${fmtP(target.price)}` : undefined}
        actions={<OnOffToggle enabled={enabled} onToggle={onToggle} />}
      />

      {open && enabled && (
        <SideBody>
          <StatGrid cols={3}>
            <StatCell label="High" value={fmtP(range.high)} tone="dn" />
            <StatCell label="EQ 50%" value={fmtP(range.equilibrium)} tone="neu" />
            <StatCell label="Low" value={fmtP(range.low)} tone="up" />
          </StatGrid>

          <div className="sb-panel-grid">
            <SideRow
              label="BOS bias"
              value={range.hasBOS && range.bosBias ? range.bosBias.toUpperCase() : '-'}
              tone={bosTone}
            />
            <SideRow label="Pools" value={`${externalCount}E · ${internalCount}I`} />
            <SideRow
              label="iFVG"
              value={
                lastIfvg
                  ? `${lastIfvg.flippedBias === 'bull' ? '▲' : '▼'} ${liquidity.inverseFvgs.length}`
                  : '-'
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
